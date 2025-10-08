// ==UserScript==
// @name         Dev Wrapper - [SCRIPT NAME]
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Auto-refreshing wrapper for userscript development
// @author       Developer
// @match        *://*/#/recordings
// @icon         https://vitejs.dev/logo.svg
// @grant        none
// ==/UserScript==

// This wrapper automatically loads your userscript from the dev server with cache-busting.
//
// Instructions:
// 1. Replace [SCRIPT NAME] with a descriptive name
// 2. Replace [ADD YOUR MATCH PATTERNS HERE] with appropriate @match patterns
// 3. Replace [SCRIPT-FILE-NAME] with the actual filename in the script below
// 4. Save this as a new userscript in Tampermonkey
// 5. Start your dev server with: bun dev
// 6. Your script will reload automatically on every page refresh
//
// Example:
// @name         Dev Wrapper - JIRA Board Utils
// @match        https://*/secure/RapidBoard.jspa*
// const scriptUrl = `http://localhost:3000/scripts/board-utils.js?t=${timestamp}`;

;(function () {
  'use strict'

  // Auto-refresh mechanism - loads script with current timestamp
  const timestamp = Date.now()
  const scriptUrl = `http://localhost:3000/scripts/cloud-share.js?t=${timestamp}`

  // Create and inject script tag
  const script = document.createElement('script')
  script.src = scriptUrl
  script.onload = () =>
    console.log('[Dev Wrapper] Script loaded with timestamp:', timestamp)
  script.onerror = () =>
    console.error('[Dev Wrapper] Failed to load script from:', scriptUrl)

  document.head.appendChild(script)
})()
