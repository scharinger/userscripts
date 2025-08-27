// ==UserScript==
// @name         PR-2-Jira: Jira ← PR Link Receiver
// @namespace    https://github.com/scharinger/userscripts
// @version      1.1
// @description  Receive a PR link and add it as a remote link to the Jira issue
// @author       Tim Scharinger
// @match        https://*/browse/*
// @icon         https://www.atlassian.com/favicon.ico
// @homepageURL  https://github.com/scharinger/userscripts
// @supportURL   https://github.com/scharinger/userscripts/issues
// @donate       https://ko-fi.com/scharinger
// @grant        none
// ==/UserScript==

(function() {
    "use strict";

    const PREFIX = '[PR-2-Jira]';
    console.log(`${PREFIX} greeting`);

    const params = new URLSearchParams(window.location.search);
    const prLink = params.get("prLink");
    if (!prLink) {
        console.warn(`${PREFIX} No prLink parameter found in URL.`);
        // showToast("PR Link", "No PR link found in URL.", "warning");
        return;
    }

    const issueKey = window.location.pathname.split("/browse/")[1];
    if (!issueKey) {
        console.warn(`${PREFIX} No issue key found in URL path.`);
        showToast("PR Link", "No Jira issue key found in URL.", "warning");
        return;
    }

    console.log(`${PREFIX} starting`, { issueKey, prLink });

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

})();
