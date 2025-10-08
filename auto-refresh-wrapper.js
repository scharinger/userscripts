// ==UserScript==
// @name         Dev Wrapper
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Auto-refreshing wrapper for userscript development
// @author       Developer
// @match        http://192.168.1.127/camera/index.html
// @run-at       document-idle
// @grant        none
// ==/UserScript==

const SCRIPT_FILE_NAME = 'cloud-share'

function onRouteChange() {
  'use strict'

  if (window.location.hash === '#/recordings') {
    console.log('[Dev Wrapper] Script init for recordings');
    // Your logic here
  }


  // Auto-refresh mechanism - loads script with current timestamp
  const timestamp = Date.now()
  const scriptUrl = `http://localhost:3000/scripts/${SCRIPT_FILE_NAME}.js?t=${timestamp}`

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

