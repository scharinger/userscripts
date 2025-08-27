// ==UserScript==
// @name         PR-2-Jira: PR → Jira Button
// @namespace    https://github.com/scharinger/userscripts
// @version      1.0
// @description  Add a button to send the current PR to Jira as a remote link
// @author       Tim Scharinger
// @match        https://github.com/*/pull/*
// @require      https://openuserjs.org/src/libs/sizzle/GM_config.js
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @icon         https://github.com/favicon.ico
// @homepageURL  https://github.com/scharinger/userscripts
// @supportURL   https://github.com/scharinger/userscripts/issues
// @donate       https://ko-fi.com/scharinger
// ==/UserScript==

(function () {
    'use strict';

    const PREFIX = '[PR-2-Jira]';

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
            console.log(`${PREFIX} Starting main script after GM_config initialization`);
            main();
        }, 100);
    }

    function main() {
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
        console.log(`${PREFIX} GM_getValue test:`, GM_getValue('PR2JiraConfig_linkPrefix', 'NOT_FOUND'));
        console.log(`${PREFIX} Available GM functions:`, {
            getValue: typeof GM_getValue,
            setValue: typeof GM_setValue
        });

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

    // Start the script when ready
    if (typeof GM_config !== 'undefined') {
        initializeScript();
    } else {
        console.error(`${PREFIX} GM_config is not available`);
    }
})();
