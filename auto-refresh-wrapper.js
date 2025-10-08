// ==UserScript==
// @name         Dev Wrapper - [SCRIPT NAME]
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Auto-refreshing wrapper for userscript development
// @author       Developer
// @match        [ADD YOUR MATCH PATTERNS HERE]
// @match        *://*
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

console.log('[Dev Wrapper] Initialing');

const SCRIPT_FILE_NAME = 'cloud-share'
const PORT = 3000

console.log('[Dev Wrapper] Initialized', { PORT, SCRIPT_FILE_NAME });


function onRouteChange() {
  'use strict'

  if (window.location.hash === '#/recordings') {
    console.log('[Dev Wrapper] Script init for recordings');
    // Your logic here
  }


  // Auto-refresh mechanism - loads script with current timestamp
  const timestamp = Date.now()
  const scriptUrl = `http://localhost:${PORT}/scripts/${SCRIPT_FILE_NAME}.js?t=${timestamp}`

  // Create and inject script tag
  const script = document.createElement('script')
  script.src = scriptUrl
  script.onload = () =>
    console.log('[Dev Wrapper] Script loaded with timestamp:', timestamp)
  script.onerror = () =>
    console.error('[Dev Wrapper] Failed to load script from:', scriptUrl)

  document.head.appendChild(script)
}

// Run on first load
onRouteChange();

// Run on hash changes
window.addEventListener('hashchange', onRouteChange);

