// ==UserScript==
// @name         PR-2-Jira: PR → Jira Button
// @namespace    https://github.com/scharinger/userscripts
// @version      1.0-beta.1
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
            }
        });

        // Add settings to Tampermonkey menu
        GM_registerMenuCommand('PR-2-Jira Settings', () => GM_config.open());

        // Start the main script
        main();
    }

    // Main script logic
    function main() {
        const jiraLinks = document.querySelectorAll('a[href*="/browse/"]');
        if (jiraLinks.length === 0) {
            console.warn(`${PREFIX} No Jira issue link found on this page.`);
            return;
        }

        // Prevent duplicate buttons
        if (document.querySelector('.pr-2-jira-btn')) {
            return;
        }

        const prUrl = window.location.href;
        const linkPrefix = GM_config.isInit ? GM_config.get('linkPrefix') : 'Solves: Jira ';

        function createButton(jiraLink) {
            const button = document.createElement("button");
            button.className = 'pr-2-jira-btn btn btn-sm';
            button.textContent = "📌 Create PR link in Jira ↗️";
            button.style.marginLeft = "0.5em";
            button.title = "Open the Jira issue and send this PR as a remote link so that the receiving script can create the PR link in Jira if it does not already exist.";

            button.addEventListener("click", () => {
                // Send the PR link via query parameter
                const jiraUrl = `${jiraLink.href}?prLink=${encodeURIComponent(prUrl)}`;
                window.open(jiraUrl, "_blank");
            });

            return button;
        }

        if (linkPrefix) {
            console.log(`${PREFIX} Configured prefix: "${linkPrefix}"`);
            console.log(`${PREFIX} Looking for links with this prefix`);
            // Create a regex to match the exact prefix
            const escapedPrefix = linkPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const prefixRegex = new RegExp(`(^|\\s|[.,;:!?\\-])${escapedPrefix}`, 'i');
            console.log(`${PREFIX} Using regex: ${prefixRegex}`);

            const buttonsPlaced = new Set();

            // Check each Jira link to see if it has matching prefix text before it
            jiraLinks.forEach((jiraLink) => {
                // Look for text that contains the prefix and comes before this link
                const linkParent = jiraLink.closest('p, div, li, td, th, span, .comment-body') || jiraLink.parentElement;
                const textContent = linkParent ? linkParent.textContent : '';

                if (prefixRegex.test(textContent)) {
                    console.log(`${PREFIX} Found prefix text for link: "${jiraLink.href}" in text: "${textContent.substring(0, 200)}"`);
                    const button = createButton(jiraLink);
                    jiraLink.parentNode.insertBefore(button, jiraLink.nextSibling);
                    buttonsPlaced.add(jiraLink.href);
                } else {
                    console.log(`${PREFIX} No prefix match for: "${jiraLink.href}" in text: "${textContent.substring(0, 100)}"`);
                }
            });

            console.log(`${PREFIX} Finished processing. Only prefix-matched links got buttons.`);
        } else {
            console.log(`${PREFIX} No prefix configured, using default position`);
            jiraLinks.forEach((jiraLink) => {
                const button = createButton(jiraLink);
                jiraLink.parentNode.insertBefore(button, jiraLink.nextSibling);
            });
        }
    }

    // Start the script when ready
    if (typeof GM_config !== 'undefined') {
        initializeScript();
    } else {
        console.error(`${PREFIX} GM_config is not available`);
    }
})();
