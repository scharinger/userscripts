// ==UserScript==
// @name         PR-2-Jira: GitHub & Jira Integration
// @namespace    https://github.com/scharinger/userscripts
// @version      2.0
// @description  Add buttons to send PR links to Jira and automatically handle PR link creation
// @author       Tim Scharinger
// @match        https://*/*/pull/*
// @match        https://*/browse/*
// @require      https://openuserjs.org/src/libs/sizzle/GM_config.js
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @icon         https://github.com/favicon.ico
// @homepageURL  https://github.com/scharinger/userscripts
// @supportURL   https://github.com/scharinger/userscripts/issues
// @updateURL    https://raw.githubusercontent.com/scharinger/userscripts/main/scripts/pr-2-jira.js
// @downloadURL  https://raw.githubusercontent.com/scharinger/userscripts/main/scripts/pr-2-jira.js
// @donate       https://ko-fi.com/scharinger
// ==/UserScript==

(function () {
    'use strict';

    const PREFIX = '[PR-2-Jira]';

    // Detect which functionality to run based on URL
    function detectPageType() {
        const hostname = window.location.hostname.toLowerCase();
        const pathname = window.location.pathname;
        
        // Check if domain contains 'github' and URL has /pull/
        if (hostname.includes('github') && pathname.includes('/pull/')) {
            return 'github';
        }
        // Check if domain contains 'jira' and URL has /browse/
        else if (hostname.includes('jira') && pathname.includes('/browse/')) {
            return 'jira';
        }
        
        return null;
    }

    // GitHub functionality
    function initializeGitHubFeatures() {
        // Wait for GM_config to be ready
        function initializeScript() {
            // Initialize GM_config
            GM_config.init({
                'id': 'PR2JiraConfig',
                'title': 'PR-2-Jira Settings',
                'fields': {
                    'linkPrefix': {
                        'label': 'Jira Link Prefix',
                        'type': 'text',
                        'default': 'Solves: Jira '
                    }
                },
                'events': {
                    'save': function() {
                        console.log(`${PREFIX} Settings saved successfully!`);
                        const newPrefix = GM_config.get('linkPrefix');
                        console.log(`${PREFIX} New linkPrefix: "${newPrefix}"`);
                        
                        // Show temporary notification
                        const notification = document.createElement('div');
                        notification.innerHTML = '✅ PR-2-Jira settings saved!';
                        notification.style.cssText = `
                            position: fixed;
                            top: 20px;
                            right: 20px;
                            background: #238636;
                            color: white;
                            padding: 12px 16px;
                            border-radius: 6px;
                            z-index: 10000;
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
                            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                        `;
                        document.body.appendChild(notification);
                        
                        setTimeout(() => {
                            notification.remove();
                        }, 3000);
                    }
                }
            });

            // Add settings to Tampermonkey menu
            GM_registerMenuCommand('PR-2-Jira Settings', () => {
                console.log(`${PREFIX} Opening settings dialog`);
                GM_config.open();
            });

            // Wait for GM_config to be fully ready, then start the main script
            setTimeout(() => {
                console.log(`${PREFIX} Starting GitHub script after GM_config initialization`);
                runGitHubScript();
            }, 100);
        }

        function runGitHubScript() {
            const jiraLinks = document.querySelectorAll('a[href*="/browse/"]');
            if (jiraLinks.length === 0) {
                console.warn(`${PREFIX} No Jira issue link found on this page.`);
                return;
            }

            if (document.querySelector('.pr-2-jira-btn')) return;

            const prUrl = window.location.href;
            const linkPrefix = GM_config.isInit ? GM_config.get('linkPrefix') : 'Solves: Jira ';
            
            console.log(`${PREFIX} GM_config.isInit: ${GM_config.isInit}`);
            console.log(`${PREFIX} Config loaded successfully: ${!!GM_config.fields}`);
            console.log(`${PREFIX} Retrieved linkPrefix: "${linkPrefix}"`);

            function createButton(jiraLink) {
                const button = document.createElement("button");
                button.className = 'pr-2-jira-btn btn btn-sm';
                button.textContent = "📌 Create PR link in Jira ↗️";
                button.style.marginLeft = "0.5em";
                button.title = "Open the Jira issue and send this PR as a remote link";

                button.addEventListener("click", () => {
                    const jiraUrl = `${jiraLink.href}?prLink=${encodeURIComponent(prUrl)}`;
                    window.open(jiraUrl, "_blank");
                });

                return button;
            }

            function addButtonToLink(jiraLink) {
                const button = createButton(jiraLink);
                jiraLink.parentNode.insertBefore(button, jiraLink.nextSibling);
            }

            function hasValidPrefix(jiraLink, prefixRegex) {
                const container = jiraLink.closest('p, div, li, td, th, span, .comment-body') || jiraLink.parentElement;
                const textContent = container?.textContent || '';
                return prefixRegex.test(textContent);
            }

            if (linkPrefix) {
                console.log(`${PREFIX} Looking for links with prefix: "${linkPrefix}"`);
                const escapedPrefix = linkPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const prefixRegex = new RegExp(`(^|\\s|[.,;:!?\\-])${escapedPrefix}`, 'i');

                jiraLinks.forEach((jiraLink) => {
                    if (hasValidPrefix(jiraLink, prefixRegex)) {
                        console.log(`${PREFIX} Adding button for: ${jiraLink.href}`);
                        addButtonToLink(jiraLink);
                    }
                });
            } else {
                console.log(`${PREFIX} No prefix configured, adding buttons to all links`);
                jiraLinks.forEach(addButtonToLink);
            }
        }

        // Start the GitHub script when ready
        if (typeof GM_config !== 'undefined') {
            initializeScript();
        } else {
            console.error(`${PREFIX} GM_config is not available`);
        }
    }

    // Jira functionality
    function initializeJiraFeatures() {
        console.log(`${PREFIX} greeting from Jira`);

        const params = new URLSearchParams(window.location.search);
        const prLink = params.get("prLink");
        if (!prLink) {
            console.warn(`${PREFIX} No prLink parameter found in URL.`);
            return;
        }

        const issueKey = window.location.pathname.split("/browse/")[1];
        if (!issueKey) {
            console.warn(`${PREFIX} No issue key found in URL path.`);
            showToast("PR Link", "No Jira issue key found in URL.", "warning");
            return;
        }

        console.log(`${PREFIX} starting Jira functionality`, { issueKey, prLink });
        addPRLink(issueKey, prLink);

        async function addPRLink(issueKey, url, title = "PR", iconUrl = "https://github.com/favicon.ico") {
            if (!issueKey || !url) return;

            const jiraHost = "https://jira.se.axis.com";

            try {
                console.log(`${PREFIX} Fetching existing remote links...`);
                const existingRes = await fetch(`${jiraHost}/rest/api/2/issue/${issueKey}/remotelink`, {
                    headers: { "Accept": "application/json" },
                    credentials: "include"
                });
                if (!existingRes.ok) throw new Error(`${PREFIX} Failed to fetch remote links: HTTP ${existingRes.status} ${existingRes.statusText}`);
                const existingLinks = await existingRes.json();
                console.log(`${PREFIX} Existing PR links:`, existingLinks);

                const exists = existingLinks.some(link => link.object?.url === url);
                if (exists) {
                    console.log(`${PREFIX} Link already exists on ${issueKey}: ${url}`);
                    showToast("PR Link", "Link already exists.", "info", 3000);
                    return;
                }

                console.log(`${PREFIX} Creating new PR link...`);
                const linkData = { object: { url, title, icon: { url16x16: iconUrl } } };
                const res = await fetch(`${jiraHost}/rest/api/2/issue/${issueKey}/remotelink`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Accept": "application/json" },
                    credentials: "include",
                    body: JSON.stringify(linkData)
                });

                if (!res.ok) {
                    const errorText = await res.text();
                    throw new Error(`${PREFIX} Failed to create PR link: HTTP ${res.status} ${res.statusText} – ${errorText}`);
                }
                console.log(`${PREFIX} PR link created on ${issueKey}: ${url}`);
                showToast("PR Link", "Link created.");
                
                // Refresh the links section to show the new link
                refreshLinksSection();
            } catch (err) {
                console.error(`${PREFIX} [ERROR]`, err);
                showToast("PR Link", `Failed to create link: ${err.message || err}`, "error");
            }
        }

        function showToast(title, body, type = "success", autoCloseDelay = null) {
            if (window.AJS?.flag) {
                console.log(`${PREFIX} AJS.flag available. Testing API...`);
                console.log(`${PREFIX} AJS.flag function:`, typeof AJS.flag);
                
                // Try AJS.flag with timeout first (newer versions might support it)
                const flagOptions = { title, body, type };
                if (autoCloseDelay) {
                    console.log(`${PREFIX} Attempting auto-close with timeout: ${autoCloseDelay}ms`);
                    flagOptions.close = 'auto';
                    flagOptions.timeout = autoCloseDelay;
                }
                
                console.log(`${PREFIX} Flag options:`, flagOptions);
                const flag = AJS.flag(flagOptions);
                console.log(`${PREFIX} Flag result:`, flag);
                console.log(`${PREFIX} Flag methods:`, flag ? Object.keys(flag) : 'no flag returned');
                
                // Always use manual timeout since Jira's auto-close doesn't seem to work reliably
                if (autoCloseDelay && flag && flag.close) {
                    console.log(`${PREFIX} Using manual setTimeout (${autoCloseDelay}ms)`);
                    setTimeout(() => {
                        try {
                            flag.close();
                            console.log(`${PREFIX} Successfully auto-closed toast`);
                        } catch (e) {
                            console.log(`${PREFIX} Could not auto-close toast:`, e);
                        }
                    }, autoCloseDelay);
                }
            } else {
                console.log(`${PREFIX} AJS.flag not available`);
                console.log(`${PREFIX} [TOAST] ${type.toUpperCase()}: ${title} – ${body}`);
            }
        }

        function refreshLinksSection() {
            // Try to find and reload the links section
            const linksSection = document.querySelector('[data-module-key="com.atlassian.jira.jira-view-issue-plugin:linkissue-web-panel"]');
            if (linksSection) {
                console.log(`${PREFIX} Refreshing links section...`);
                // Trigger a re-render by dispatching a custom event
                window.dispatchEvent(new CustomEvent('jira:refresh-issue-links'));
                
                // Fallback: reload the specific module if available
                if (window.JIRA?.Issue?.refreshIssuePage) {
                    setTimeout(() => window.JIRA.Issue.refreshIssuePage(), 1000);
                } else {
                    // Last resort: reload the entire issue view after a delay
                    setTimeout(() => window.location.reload(), 2000);
                }
            } else {
                console.log(`${PREFIX} Links section not found, will reload page...`);
                setTimeout(() => window.location.reload(), 1000);
            }
        }
    }

    // Main initialization
    const pageType = detectPageType();
    console.log(`${PREFIX} Detected page type: ${pageType}`);

    if (pageType === 'github') {
        initializeGitHubFeatures();
    } else if (pageType === 'jira') {
        initializeJiraFeatures();
    } else {
        console.log(`${PREFIX} No matching page type found`);
    }
})();