// ==UserScript==
// @name         AXIS Web UI Recording Clip Cloud Share
// @namespace    https://github.com/scharinger/userscripts
// @version      0.1
// @description  Adds a Share button next to the export button to share data via cloud service
// @author       Tim Scharinger
// @match        *://*/camera/index.html#/recordings
// @match        *://*/#/recordings
// @supportURL   https://github.com/scharinger/userscripts/issues/new?labels=bug&projects=scharinger/1
// @updateURL    https://raw.githubusercontent.com/scharinger/userscripts/main/scripts/cloud-share.js
// @downloadURL  https://raw.githubusercontent.com/scharinger/userscripts/main/scripts/cloud-share.js
// @grant        none
// ==/UserScript==

console.log('[Cloud Share] Script loaded');


(function() {
    'use strict';

console.log('[Cloud Share] Script executing');


    // Find the export button (change selector if needed)
    function findExportButton() {
        // Find any button with text "Export" visible on the page
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
            if (btn.textContent.trim() === 'Export') {
                return btn;
            }
        }
        return null;
    }

    // Create the Share button element
    function createShareButton() {
        const shareBtn = document.createElement('button');
        shareBtn.textContent = 'Share';
        shareBtn.style.marginLeft = '8px';
        shareBtn.className = 'cloud-share-btn';
        shareBtn.onclick = openShareModal;
        return shareBtn;
    }

    // Open the share modal dialog
    function openShareModal() {
        // Create modal
        let modal = document.createElement('div');
        modal.id = 'cloud-share-modal';
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100vw';
        modal.style.height = '100vh';
        modal.style.background = 'rgba(0,0,0,0.5)';
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.style.zIndex = '9999';

        // Modal content
        let content = document.createElement('div');
        content.style.background = '#fff';
        content.style.padding = '24px';
        content.style.borderRadius = '8px';
        content.style.minWidth = '300px';
        content.innerHTML = `
            <h2>Share via cloud service</h2>
            <button id="share-google">Google Drive</button>
            <button id="share-onedrive">OneDrive</button>
            <button id="close-share-modal" style="float:right">Close</button>
        `;
        modal.appendChild(content);
        document.body.appendChild(modal);

        document.getElementById('close-share-modal').onclick = () => {
            modal.remove();
        };

        document.getElementById('share-google').onclick = () => {
            alert('Google Drive integration coming soon');
            // TODO: Add code to share buffer to Google Drive
        };
        document.getElementById('share-onedrive').onclick = () => {
            alert('OneDrive integration coming soon');
            // TODO: Add code to share buffer to OneDrive
        };
    }

    // Inject the Share button next to the Export button
    function injectShareButton() {
        const exportBtn = findExportButton();
        if (exportBtn && !document.querySelector('.cloud-share-btn')) {
            exportBtn.parentNode.insertBefore(createShareButton(), exportBtn.nextSibling);
        }
    }

    // Wait until DOM is ready
    document.addEventListener('DOMContentLoaded', injectShareButton);

    // Use MutationObserver to rerun injectShareButton when DOM changes
    const observer = new MutationObserver(() => {
        console.log('[Cloud Share] DOM changed, re-evaluating...');
        injectShareButton();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // TODO: Function to fetch buffer from API and share to cloud service
    // function getBufferFromApi() { ... }

})();
