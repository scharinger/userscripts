// ==UserScript==
// @name         Jira Board Utils
// @namespace    https://github.com/scharinger/userscripts
// @version      1.1
// @description  Add custom project images to Jira board cards based on configurable color rules
// @author       Tim Scharinger
// @match        https://*/secure/RapidBoard.jspa*
// @icon         https://www.atlassian.com/favicon.ico
// @homepageURL  https://github.com/scharinger/userscripts
// @supportURL   https://github.com/scharinger/userscripts/issues/new?labels=bug&projects=scharinger/1
// @updateURL    https://raw.githubusercontent.com/scharinger/userscripts/main/scripts/board-utils.js
// @downloadURL  https://raw.githubusercontent.com/scharinger/userscripts/main/scripts/board-utils.js
// @donate       https://ko-fi.com/scharinger
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const PREFIX = '[Board Utils]';
    const TOAST_AUTO_CLOSE_DELAY = 3000;

    
    // Simplified board configuration fetch - delegates to fetchCardColors since that's all we need
    async function fetchBoardConfiguration(boardId) {
        console.log(`${PREFIX} === FETCHING BOARD CONFIGURATION (delegating to fetchCardColors) ===`);
        return await fetchCardColors(boardId);
    }
    
    // Function to fetch card colors using the correct API endpoint from HAR analysis
    async function fetchCardColors(boardId) {
        console.log(`${PREFIX} === FETCHING CARD COLORS (Updated from HAR) ===`);
        
        try {
            // Use the exact endpoint from the HAR file
            const timestamp = Date.now();
            const response = await fetch(`/rest/greenhopper/1.0/cardcolors/${boardId}/strategy/custom?preloadValues=true&_=${timestamp}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json, text/javascript, */*; q=0.01',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                credentials: 'same-origin'
            });
            
            if (response.ok) {
                const cardColors = await response.json();
                console.log(`${PREFIX} Card Colors Response:`, cardColors);
                
                // Analyze the structure
                console.log(`${PREFIX} Response keys:`, Object.keys(cardColors));
                
                if (cardColors.cardColors && Array.isArray(cardColors.cardColors)) {
                    console.log(`${PREFIX} Found ${cardColors.cardColors.length} card color rules:`);
                    cardColors.cardColors.forEach((rule, index) => {
                        console.log(`${PREFIX} Rule ${index}:`, {
                            id: rule.id,
                            value: rule.value,
                            strategy: rule.strategy,
                            color: rule.color,
                            rgb: rule.rgb
                        });
                    });
                    
                    // Extract colors (try both 'color' and 'rgb' properties)
                    const colors = cardColors.cardColors.map(rule => rule.color || rule.rgb).filter(color => color);
                    const uniqueColors = [...new Set(colors)];
                    console.log(`${PREFIX} Unique colors found:`, uniqueColors);
                    return uniqueColors;
                }
                
                // Also try if it's a direct array
                if (Array.isArray(cardColors)) {
                    console.log(`${PREFIX} Direct array with ${cardColors.length} rules`);
                    const colors = cardColors.map(rule => rule.color || rule.rgb).filter(color => color);
                    const uniqueColors = [...new Set(colors)];
                    console.log(`${PREFIX} Unique colors found:`, uniqueColors);
                    return uniqueColors;
                }
                
                return cardColors;
            } else {
                console.log(`${PREFIX} Failed to fetch card colors: ${response.status} ${response.statusText}`);
                return null;
            }
        } catch (error) {
            console.error(`${PREFIX} Error fetching card colors:`, error);
            return null;
        }
    }
    
    // Function to get Project ID from Project Key
    async function getProjectIdFromKey(projectKey) {
        if (!projectKey || typeof projectKey !== 'string') return null;
        
        try {
            console.log(`${PREFIX} Fetching project ID for key: ${projectKey}`);
            const response = await fetch(`/rest/api/2/project/${projectKey.toUpperCase()}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                credentials: 'same-origin'
            });
            
            if (response.ok) {
                const project = await response.json();
                console.log(`${PREFIX} Found project ID ${project.id} for key ${projectKey}`);
                return project.id;
            } else {
                console.log(`${PREFIX} Failed to get project ID for ${projectKey}: ${response.status}`);
                return null;
            }
        } catch (error) {
            console.error(`${PREFIX} Error fetching project ID:`, error);
            return null;
        }
    }

    // Debug functions
    window.fetchBoardConfig = fetchBoardConfiguration;
    window.fetchCardColors = fetchCardColors;
    window.getProjectIdFromKey = getProjectIdFromKey;
    
    // Debug function to inspect existing images
    window.debugBoardImages = function() {
        const images = document.querySelectorAll('.custom-board-img');
        console.log(`${PREFIX} [DEBUG] Found ${images.length} custom images:`);
        images.forEach((img, index) => {
            console.log(`${PREFIX} [DEBUG] Custom Image ${index + 1}:`, {
                src: img.src,
                visible: img.offsetWidth > 0 && img.offsetHeight > 0,
                width: img.offsetWidth,
                height: img.offsetHeight,
                style: img.style.cssText,
                element: img
            });
        });
        
        const allImages = document.querySelectorAll('.ghx-type img');
        console.log(`${PREFIX} [DEBUG] Found ${allImages.length} total images in .ghx-type containers`);
    };

    const SELECTORS = {
        cardGrabbers: "#ghx-pool .ghx-grabber.ghx-grabber-transparent",
        grabberPool: "#ghx-pool",
        cardFooter: ".ghx-card-footer",
    };

    // Default configuration structure
    const DEFAULT_BOARD_CONFIG = {
        enabled: false,
        boardId: null,
        selectedRuleId: null,
        selectedRuleColor: null,
        projectKey: '',
        projectId: '',
        avatarId: '',
        customImageUrl: '',
        imageUrl: '' // Computed from projectKey/projectId and avatarId
    };

    // Get all board configurations from localStorage
    function getAllConfigs() {
        const stored = localStorage.getItem('jira-board-utils-configs');
        return stored ? JSON.parse(stored) : [];
    }

    // Get configuration for a specific board
    function getConfigForBoard(boardId) {
        const allConfigs = getAllConfigs();
        const boardConfig = allConfigs.find(config => config.boardId === boardId);
        
        if (boardConfig) {
            return boardConfig;
        }
        
        // Return default config with the specified boardId
        return {
            ...DEFAULT_BOARD_CONFIG,
            boardId: boardId
        };
    }

    // Save configuration for a specific board
    function saveConfigForBoard(boardConfig) {
        const allConfigs = getAllConfigs();
        const existingIndex = allConfigs.findIndex(config => config.boardId === boardConfig.boardId);
        
        if (existingIndex >= 0) {
            // Update existing config
            allConfigs[existingIndex] = boardConfig;
        } else {
            // Add new config
            allConfigs.push(boardConfig);
        }
        
        localStorage.setItem('jira-board-utils-configs', JSON.stringify(allConfigs));
        console.log(`${PREFIX} Saved config for board ${boardConfig.boardId}:`, boardConfig);
    }

    // Create and show settings dialog using AJS
    async function showSettingsDialog() {
        // Get current board ID from URL
        const currentBoardId = new URLSearchParams(window.location.search).get('rapidView');
        if (!currentBoardId) {
            alert('Could not determine current board ID from URL');
            return;
        }
        
        const config = getConfigForBoard(currentBoardId);
        
        if (!window.AJS) {
            console.log(`${PREFIX} AJS not available, falling back to simple dialog`);
            await showFallbackDialog();
            return;
        }

        // Try AJS.dialog (version 1) first
        if (window.AJS.dialog) {
            const dialog = new window.AJS.Dialog({
                width: 500,
                height: 400,
                id: "board-utils-dialog",
                closeOnOutsideClick: true
            });

            dialog.addHeader("Board Utils Settings");
            
            const content = `
                <form class="aui">
                    <div class="field-group">
                        <label for="boardId-dialog">Board ID</label>
                        <input class="text medium-field" type="text" id="boardId-dialog" value="${config.boardId}">
                        <div class="description">The rapid view ID from the URL</div>
                    </div>
                    <div class="field-group">
                        <label for="cardColor-dialog">Card Color (RGB)</label>
                        <input class="text long-field" type="text" id="cardColor-dialog" value="${config.cardColor}" placeholder="rgb(209, 50, 50)">
                        <div class="description">RGB color value to match</div>
                    </div>
                    <div class="field-group">
                        <label for="imageUrl-dialog">Image URL</label>
                        <input class="text long-field" type="url" id="imageUrl-dialog" value="${config.imageUrl}">
                        <div class="description">URL to the image to display</div>
                    </div>
                </form>
            `;
            
            dialog.addPanel("Panel 1", content, "panel-body");
            
            dialog.addButton("Save", function (dialog) {
                const newConfig = {
                    boardId: document.getElementById('boardId-dialog').value,
                    cardColor: document.getElementById('cardColor-dialog').value,
                    imageUrl: document.getElementById('imageUrl-dialog').value
                };
                saveConfig(newConfig);
                
                if (window.AJS.flag) {
                    window.AJS.flag({
                        type: 'success',
                        title: 'Settings saved',
                        body: 'Refresh the page to apply changes.'
                    });
                }
                
                dialog.hide();
            });
            
            dialog.addButton("Cancel", function (dialog) {
                dialog.hide();
            });

            dialog.show();
            return;
        }

        // Fallback to simple approach
        console.log(`${PREFIX} No suitable AJS dialog found, falling back`);
        await showFallbackDialog();
    }

    // Fallback dialog for when AJS is not available
    async function showFallbackDialog() {
        // Get current board ID from URL
        const currentBoardId = new URLSearchParams(window.location.search).get('rapidView');
        if (!currentBoardId) {
            alert('Could not determine current board ID from URL');
            return;
        }
        
        const config = getConfigForBoard(currentBoardId);
        
        // Fetch current board's card colors
        let cardColorRules = [];
        try {
            const boardId = config.boardId || DEFAULT_CONFIG.boardId;
            console.log(`${PREFIX} Fetching card colors for board ID: ${boardId}`);
            
            // Call the API directly instead of using fetchCardColors which only returns colors array
            const timestamp = Date.now();
            const response = await fetch(`/rest/greenhopper/1.0/cardcolors/${boardId}/strategy/custom?preloadValues=true&_=${timestamp}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json, text/javascript, */*; q=0.01',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                credentials: 'same-origin'
            });
            
            if (response.ok) {
                const colorResponse = await response.json();
                console.log(`${PREFIX} Card colors response:`, colorResponse);
                if (colorResponse && colorResponse.cardColors && Array.isArray(colorResponse.cardColors)) {
                    cardColorRules = colorResponse.cardColors;
                    console.log(`${PREFIX} Found ${cardColorRules.length} card color rules`);
                }
            } else {
                console.log(`${PREFIX} Failed to fetch card colors: ${response.status}`);
            }
        } catch (error) {
            console.log(`${PREFIX} Could not fetch card colors:`, error);
        }
        
        // Remove existing dialog if any
        const existing = document.getElementById('board-utils-custom-dialog');
        if (existing) existing.remove();
        
        const backdrop = document.createElement('div');
        backdrop.id = 'board-utils-custom-dialog';
        backdrop.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 9999;
            display: flex;
            justify-content: center;
            align-items: center;
        `;
        
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: var(--ds-surface-overlay, #fff);
            color: var(--ds-text, #172b4d);
            border-radius: 3px;
            box-shadow: var(--ds-shadow-overlay, 0 10px 50px rgba(0, 0, 0, 0.5));
            width: 500px;
            max-width: 90vw;
            max-height: 90vh;
            overflow: hidden;
        `;
        
        // Build card color rules HTML from the cardColors array
        let cardColorRulesHtml = '';
        if (cardColorRules.length > 0) {
            console.log(`${PREFIX} Building HTML for ${cardColorRules.length} rules:`, cardColorRules);
            cardColorRulesHtml = cardColorRules.map((rule) => `
                <div style="display: flex; align-items: center; margin-bottom: 8px; padding: 8px; border: 1px solid var(--ds-border, #ddd); border-radius: 3px; background: var(--ds-surface, #fff);">
                    <input type="radio" name="colorRule" id="rule-${rule.id}" value="${rule.id}" ${config.selectedRuleId == rule.id ? 'checked' : ''} ${config.enabled ? '' : 'disabled'}
                           style="margin-right: 8px;">
                    <div style="width: 16px; height: 16px; background: ${rule.color}; border: 1px solid #ccc; border-radius: 2px; margin-right: 8px; flex-shrink: 0;"></div>
                    <label for="rule-${rule.id}" style="flex-grow: 1; cursor: pointer; font-size: 13px; color: var(--ds-text, #172b4d);">
                        ${(rule.displayValue || rule.value || '').trim()}
                    </label>
                </div>
            `).join('');
        } else {
            cardColorRulesHtml = '<div style="color: var(--ds-text-subtle, #6b778c); font-style: italic;">No card color rules found. Please check Board ID.</div>';
        }

        // currentBoardId already defined above
        
        dialog.innerHTML = `
            <div style="padding: 24px; border-bottom: 1px solid var(--ds-border, #ddd);">
                <h2 style="margin: 0; font-size: 20px; color: var(--ds-text, #172b4d);">Board Utils Settings</h2>
            </div>
            <div style="padding: 24px;">
                <div style="margin-bottom: 20px;">
                    <div style="display: flex; align-items: center; margin-bottom: 10px;">
                        <input type="checkbox" id="enable-board-utils" ${config.enabled ? 'checked' : ''} style="margin-right: 8px; transform: scale(1.2);">
                        <label for="enable-board-utils" style="font-weight: 600; color: var(--ds-text, #172b4d); cursor: pointer;">Show icons for selected cards</label>
                    </div>
                    <div style="font-size: 12px; color: var(--ds-text-subtle, #6b778c); margin-bottom: 15px;">Board ID: ${currentBoardId}</div>
                    
                    <div id="rules-section" style="opacity: ${config.enabled ? '1' : '0.5'};">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <label style="font-weight: 600; color: var(--ds-text, #172b4d);">Card Color Rules</label>
                            <a href="/secure/RapidView.jspa?rapidView=${currentBoardId}&tab=cardColors#" target="_blank" 
                               style="font-size: 12px; color: var(--ds-link, #0052cc); text-decoration: none;">
                                ⚙️ Manage Rules
                            </a>
                        </div>
                        <div style="max-height: 200px; overflow-y: auto; border: 1px solid var(--ds-border, #ddd); border-radius: 3px; padding: 8px;">
                            ${cardColorRulesHtml}
                        </div>
                        <div style="font-size: 12px; color: var(--ds-text-subtle, #6b778c); margin-top: 5px;">
                            Select which color rule should trigger the image placement. 
                            <a href="/secure/RapidView.jspa?rapidView=${currentBoardId}&tab=cardColors#" target="_blank" 
                               style="color: var(--ds-link, #0052cc); text-decoration: none;">Click here</a> 
                            to add, edit, or delete card color rules for this board.
                        </div>
                    </div>
                </div>
                
                <div style="margin-bottom: 20px; opacity: ${config.enabled ? '1' : '0.5'};" id="image-section">
                    <label style="display: block; margin-bottom: 5px; font-weight: 600; color: var(--ds-text, #172b4d);">Project Image</label>
                    
                    <div style="display: flex; gap: 8px; margin-bottom: 8px;">
                        <div style="flex: 1;">
                            <label style="display: block; margin-bottom: 3px; font-size: 12px; color: var(--ds-text, #172b4d);">Project Key</label>
                            <input type="text" id="projectKey-custom" value="${config.projectKey || ''}" placeholder="e.g. FTWEB, MFW" ${config.enabled ? '' : 'disabled'} 
                                   style="width: 100%; padding: 6px; border: 2px solid var(--ds-border-input, #ddd); border-radius: 3px; font-size: 14px; box-sizing: border-box; background: var(--ds-surface, #fff); color: var(--ds-text, #172b4d); text-transform: uppercase;">
                        </div>
                        <div style="flex: 1;">
                            <label style="display: block; margin-bottom: 3px; font-size: 12px; color: var(--ds-text, #172b4d);">Avatar ID (optional)</label>
                            <input type="text" id="avatarId-custom" value="${config.avatarId || ''}" placeholder="e.g. 15111" ${config.enabled ? '' : 'disabled'} 
                                   style="width: 100%; padding: 6px; border: 2px solid var(--ds-border-input, #ddd); border-radius: 3px; font-size: 14px; box-sizing: border-box; background: var(--ds-surface, #fff); color: var(--ds-text, #172b4d);">
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 8px;">
                        <label style="display: block; margin-bottom: 3px; font-size: 12px; color: var(--ds-text, #172b4d);">Or Custom Image URL</label>
                        <input type="url" id="imageUrl-custom" value="${config.customImageUrl || ''}" placeholder="https://..." ${config.enabled ? '' : 'disabled'} 
                               style="width: 100%; padding: 6px; border: 2px solid var(--ds-border-input, #ddd); border-radius: 3px; font-size: 14px; box-sizing: border-box; background: var(--ds-surface, #fff); color: var(--ds-text, #172b4d);">
                    </div>
                    
                    <div style="font-size: 12px; color: var(--ds-text-subtle, #6b778c); margin-top: 5px;">
                        Enter a Project ID to use its avatar, or provide a custom image URL. 
                        Project avatar URL will be: <code>/secure/projectavatar?pid=[ProjectID]&avatarId=[AvatarID]</code>
                    </div>
                </div>
            </div>
            <div style="padding: 20px 24px; border-top: 1px solid var(--ds-border, #ddd); text-align: right;">
                <button id="cancel-custom" style="background: none; border: none; color: var(--ds-link, #0052cc); padding: 6px 12px; margin-right: 8px; cursor: pointer; border-radius: 3px;">Cancel</button>
                <button id="save-custom" style="background: var(--ds-background-brand-bold, #0052cc); color: var(--ds-text-inverse, #fff); border: none; padding: 8px 16px; border-radius: 3px; cursor: pointer; font-weight: 600;">Save</button>
            </div>
        `;
        
        backdrop.appendChild(dialog);
        document.body.appendChild(backdrop);
        
        // Toggle visibility of sections based on enable checkbox
        const enableCheckbox = document.getElementById('enable-board-utils');
        const rulesSection = document.getElementById('rules-section');
        const imageSection = document.getElementById('image-section');
        
        enableCheckbox.addEventListener('change', function() {
            const isEnabled = this.checked;
            
            // Update opacity
            rulesSection.style.opacity = isEnabled ? '1' : '0.5';
            imageSection.style.opacity = isEnabled ? '1' : '0.5';
            
            // Enable/disable radio buttons
            const radioButtons = dialog.querySelectorAll('input[name="colorRule"]');
            radioButtons.forEach(radio => {
                radio.disabled = !isEnabled;
            });
            
            // Enable/disable image inputs
            const projectKeyInput = document.getElementById('projectKey-custom');
            const avatarIdInput = document.getElementById('avatarId-custom');
            const imageInput = document.getElementById('imageUrl-custom');
            projectKeyInput.disabled = !isEnabled;
            avatarIdInput.disabled = !isEnabled;
            imageInput.disabled = !isEnabled;
        });
        
        // Event listeners
        document.getElementById('save-custom').onclick = async () => {
            const isEnabled = document.getElementById('enable-board-utils').checked;
            
            // Get selected rule (only if enabled)
            const selectedRuleRadio = document.querySelector('input[name="colorRule"]:checked');
            const selectedRuleId = selectedRuleRadio ? selectedRuleRadio.value : null;
            const selectedRule = cardColorRules.find(rule => rule.id == selectedRuleId);
            
            // Get image configuration
            const projectKey = document.getElementById('projectKey-custom').value.trim().toUpperCase();
            const avatarId = document.getElementById('avatarId-custom').value.trim();
            const customImageUrl = document.getElementById('imageUrl-custom').value.trim();
            
            // Get project ID from project key if needed
            let projectId = '';
            let finalImageUrl = '';
            
            if (customImageUrl) {
                finalImageUrl = customImageUrl;
            } else if (projectKey) {
                try {
                    projectId = await getProjectIdFromKey(projectKey);
                    if (projectId) {
                        finalImageUrl = `/secure/projectavatar?pid=${projectId}`;
                        if (avatarId) {
                            finalImageUrl += `&avatarId=${avatarId}`;
                        }
                    } else {
                        alert(`Could not find project ID for key "${projectKey}". Please check the project key.`);
                        return;
                    }
                } catch (error) {
                    console.error(`${PREFIX} Error resolving project key:`, error);
                    alert(`Error resolving project key "${projectKey}". Using project key as fallback.`);
                    finalImageUrl = `/secure/projectavatar?pid=${projectKey}`;
                    if (avatarId) {
                        finalImageUrl += `&avatarId=${avatarId}`;
                    }
                }
            }
            
            const newConfig = {
                enabled: isEnabled,
                boardId: currentBoardId,
                selectedRuleId: selectedRuleId,
                selectedRuleColor: selectedRule ? selectedRule.color : null,
                projectKey: projectKey,
                projectId: projectId,
                avatarId: avatarId,
                customImageUrl: customImageUrl,
                imageUrl: finalImageUrl
            };
            
            console.log(`${PREFIX} === SAVING CONFIG ===`);
            console.log(`${PREFIX} Enabled:`, isEnabled);
            console.log(`${PREFIX} Current board ID:`, currentBoardId);
            console.log(`${PREFIX} Selected rule ID:`, selectedRuleId);
            console.log(`${PREFIX} Selected rule:`, selectedRule);
            console.log(`${PREFIX} New config:`, newConfig);
            console.log(`${PREFIX} === END SAVING CONFIG ===`);
            
            saveConfigForBoard(newConfig);
            
            // Try to trigger a partial board refresh instead of full page reload
            try {
                console.log(`${PREFIX} Attempting to refresh board content...`);
                
                // Method 1: Try GreenHopper's refresh function
                if (window.GH && window.GH.RapidBoard && typeof window.GH.RapidBoard.reload === 'function') {
                    window.GH.RapidBoard.reload();
                    console.log(`${PREFIX} Successfully triggered GH.RapidBoard.reload()`);
                } 
                // Method 2: Try triggering a board reload event
                else if (window.JIRA && window.JIRA.trigger) {
                    window.JIRA.trigger('board.reload');
                    console.log(`${PREFIX} Triggered JIRA board.reload event`);
                }
                // Method 3: Try to find and click a refresh button
                else {
                    const refreshButton = document.querySelector('[data-testid="board.header.refresh-button"], .ghx-refresh, #ghx-refresh');
                    if (refreshButton) {
                        refreshButton.click();
                        console.log(`${PREFIX} Clicked refresh button`);
                    } else {
                        throw new Error('No refresh method found');
                    }
                }
                
                // Re-run boardUtils after a short delay to apply changes immediately
                setTimeout(() => {
                    console.log(`${PREFIX} Re-running boardUtils after refresh...`);
                    boardUtils();
                }, 1000);
                
                if (window.AJS && window.AJS.flag) {
                    const flag = window.AJS.flag({
                        type: 'success',
                        title: 'Settings saved',
                        body: 'Board refreshed automatically!'
                    });
                    // Auto-close flag after 5 seconds
                    setTimeout(() => {
                        if (flag && flag.close) {
                            flag.close();
                        }
                    }, TOAST_AUTO_CLOSE_DELAY);
                } else {
                    alert('Settings saved and board refreshed!');
                }
            } catch (error) {
                console.log(`${PREFIX} Could not auto-refresh board, fallback to manual reload:`, error);
                if (window.AJS && window.AJS.flag) {
                    const flag = window.AJS.flag({
                        type: 'success',
                        title: 'Settings saved',
                        body: 'Please refresh the page to apply changes.'
                    });
                    // Auto-close flag after 5 seconds
                    setTimeout(() => {
                        if (flag && flag.close) {
                            flag.close();
                        }
                    }, TOAST_AUTO_CLOSE_DELAY);
                } else {
                    alert('Settings saved! Please refresh the page to apply changes.');
                }
            }
            
            backdrop.remove();
        };
        
        document.getElementById('cancel-custom').onclick = () => {
            backdrop.remove();
        };
        
        backdrop.onclick = (e) => {
            if (e.target === backdrop) {
                backdrop.remove();
            }
        };
        
        // Focus first input
        setTimeout(() => {
            document.getElementById('boardId-custom').focus();
        }, 100);
    }

    // Create settings button in ghx-modes-tools
    function createSettingsButton() {
        const ghxModesTools = document.querySelector('#ghx-modes-tools');
        if (!ghxModesTools) {
            console.log(`${PREFIX} ghx-modes-tools not found, falling back to body`);
            createFallbackSettingsButton();
            return;
        }

        const button = document.createElement('button');
        button.textContent = 'Board Utils';
        button.className = 'aui-button';
        button.setAttribute('resolved', '');
        button.style.cssText = `margin-left: 8px;`;
        
        button.onclick = () => {
            showSettingsDialog();
        };
        
        // Insert into the same container as the Board button
        const boardButton = document.querySelector('#board-tools-section-button');
        if (boardButton && boardButton.parentElement) {
            // Insert in the same ghx-view-section as the Board button
            const viewSection = boardButton.parentElement;
            viewSection.appendChild(button);
            console.log(`${PREFIX} Settings button added next to Board button`);
        } else {
            // Fallback: Insert into ghx-view-tools or at the end of ghx-modes-tools
            const ghxViewTools = ghxModesTools.querySelector('#ghx-view-tools');
            if (ghxViewTools) {
                ghxViewTools.appendChild(button);
            } else {
                ghxModesTools.appendChild(button);
            }
            console.log(`${PREFIX} Settings button added to fallback location`);
        }
        
        console.log(`${PREFIX} Settings button added to ghx-modes-tools`);
    }

    // Fallback for when ghx-modes-tools is not available
    function createFallbackSettingsButton() {
        const button = document.createElement('button');
        button.textContent = '⚙️ Board Utils Settings';
        button.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            padding: 10px 15px;
            background: #0052cc;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        `;
        
        button.onclick = () => {
            showSettingsDialog();
        };
        
        document.body.appendChild(button);
    }

    async function boardUtils() {
        try {
            // Get current board ID from URL
            const currentBoardId = new URLSearchParams(window.location.search).get('rapidView');
            if (!currentBoardId) {
                console.log(`${PREFIX} Could not determine current board ID from URL`);
                return;
            }
            
            const config = getConfigForBoard(currentBoardId);
            console.log(`${PREFIX} Config loaded for board ${currentBoardId}:`, config);
            
            // Check if Board Utils is enabled for this board
            if (!config.enabled) {
                console.log(`${PREFIX} Board Utils is disabled for board ${currentBoardId}, skipping`);
                return;
            }
            
            const { selectedRuleColor, imageUrl } = config;
            const boardPath = `/secure/RapidBoard.jspa?rapidView=${currentBoardId}`;
            console.log(`${PREFIX} Looking for board path: ${boardPath}`);
            console.log(`${PREFIX} Current URL: ${window.location.href}`);
            
            // Use selected rule color, or fetch all colors if none selected
            let configuredColors = [];
            if (selectedRuleColor) {
                configuredColors = [selectedRuleColor];
                console.log(`${PREFIX} Using selected rule color:`, selectedRuleColor);
            } else {
                const colorResponse = await fetchCardColors(currentBoardId);
                if (colorResponse && Array.isArray(colorResponse)) {
                    configuredColors = colorResponse;
                } else {
                    console.log(`${PREFIX} No rule selected and failed to fetch colors, using fallback`);
                    configuredColors = [];
                }
            }
            console.log(`${PREFIX} Using colors:`, configuredColors);
            
            const imageMarkup = `<div class="custom-board-image"><img src="${imageUrl}" alt="Custom Board Image" title="Custom Board Image" class="custom-board-img" style="width: 16px; height: 16px; margin-left: 4px;"></div>`;

            function throttle(func, limit) {
                let inThrottle;
                return function (...args) {
                    if (!inThrottle) {
                        func.apply(this, args);
                        inThrottle = true;
                        setTimeout(() => {
                            inThrottle = false;
                        }, limit);
                    }
                };
            }

            function observeGrabbers() {
                const targetNode = document.querySelector(SELECTORS.grabberPool);
                if (!targetNode) {
                    console.log(`${PREFIX} Target node not found: ${SELECTORS.grabberPool}`);
                    return;
                }
                console.log(`${PREFIX} Found target node, setting up observer`);

                const mutationCallback = throttle((mutationsList) => {
                    for (const mutation of mutationsList) {
                        if (mutation.type === "attributes") {
                            processCardGrabber(mutation.target, configuredColors, ' [Observer]');
                        }
                    }
                }, 200);

                const observer = new MutationObserver(mutationCallback);
                observer.observe(targetNode, {
                    attributes: true,
                    subtree: true,
                    attributeFilter: ["style"],
                });
                console.log(`${PREFIX} Mutation observer set up.`);
            }

            function waitForGrabbers(callback) {
                console.log(`${PREFIX} Waiting for grabbers: ${SELECTORS.cardGrabbers}`);
                const interval = setInterval(() => {
                    const cardGrabbers = document.querySelectorAll(SELECTORS.cardGrabbers);
                    console.log(`${PREFIX} Found ${cardGrabbers.length} grabbers`);
                    if (cardGrabbers.length > 0) {
                        clearInterval(interval);
                        console.log(`${PREFIX} Grabbers found, proceeding with callback`);
                        callback(Array.from(cardGrabbers));
                    }
                }, 1000);
            }


            function matchesAnyColor(elementColor, configuredColors) {
                if (!configuredColors || !Array.isArray(configuredColors)) return false;
                
                // Convert RGB to hex for comparison
                function rgbToHex(rgb) {
                    if (rgb.startsWith('#')) return rgb;
                    const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
                    if (match) {
                        const [, r, g, b] = match;
                        return '#' + [r, g, b].map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
                    }
                    return rgb;
                }
                
                const elementHex = rgbToHex(elementColor);
                return configuredColors.some(configColor => {
                    const configHex = rgbToHex(configColor);
                    return elementHex === configHex;
                });
            }

            function addImageToCardFooter(cardFooter, context = '') {
                if (!cardFooter.querySelector('.custom-board-img')) {
                    console.log(`${PREFIX}${context} Adding image to card footer`, cardFooter);
                    console.log(`${PREFIX}${context} Image markup:`, imageMarkup);
                    
                    // Find the best insertion point: after flags, before days
                    const daysElement = cardFooter.querySelector('.ghx-days');
                    const flagsElement = cardFooter.querySelector('.ghx-flags');
                    
                    if (daysElement) {
                        daysElement.insertAdjacentHTML('beforebegin', imageMarkup);
                        console.log(`${PREFIX}${context} Image inserted before ghx-days`);
                    } else if (flagsElement) {
                        flagsElement.insertAdjacentHTML('afterend', imageMarkup);
                        console.log(`${PREFIX}${context} Image inserted after ghx-flags`);
                    } else {
                        cardFooter.innerHTML += imageMarkup;
                        console.log(`${PREFIX}${context} No specific elements found, appended to end`);
                    }
                    console.log(`${PREFIX}${context} Card footer after adding image:`, cardFooter.innerHTML);
                } else {
                    const existingImg = cardFooter.querySelector('.custom-board-img');
                    console.log(`${PREFIX}${context} Image already exists:`, existingImg);
                    console.log(`${PREFIX}${context} Image src:`, existingImg?.src);
                    console.log(`${PREFIX}${context} Image visible?`, existingImg?.offsetWidth > 0 && existingImg?.offsetHeight > 0);
                }
            }

            function processCardGrabber(cardGrabber, configuredColors, context = '') {
                const elementColor = window.getComputedStyle(cardGrabber).backgroundColor;
                const matchesColor = matchesAnyColor(elementColor, configuredColors);
                
                console.log(`${PREFIX}${context} Checking color: ${elementColor} matches configured colors? ${matchesColor}`);
                
                if (matchesColor) {
                    console.log(`${PREFIX}${context} Found matching color, looking for card footer`);
                    let sibling = cardGrabber.nextElementSibling;

                    while (sibling) {
                        if (sibling.classList?.contains("ghx-card-footer")) {
                            addImageToCardFooter(sibling, context);
                            break;
                        }
                        sibling = sibling.nextElementSibling;
                    }
                }
            }

            waitForGrabbers((cardGrabbers) => {
                if (!window.location.href.includes(boardPath)) {
                    console.log(`${PREFIX} Not on target board, skipping`);
                    return;
                }
                console.log(`${PREFIX} Processing ${cardGrabbers.length} card grabbers`);
                for (const cardGrabber of cardGrabbers) {
                    processCardGrabber(cardGrabber, configuredColors);
                }
                observeGrabbers();
            });
        } catch (error) {
            console.log(`${PREFIX} Error:`, { error });
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            createSettingsButton();
            boardUtils();
        });
    } else {
        createSettingsButton();
        boardUtils();
    }

})();