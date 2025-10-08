// ==UserScript==
// @name         AXIS Web UI Recording Clip Cloud Share
// @namespace    https://github.com/scharinger/userscripts
// @version      0.2
// @description  Adds a Share button next to the export button to share data via cloud service
// @author       Tim Scharinger
// @match        *://*/camera/index.html*
// @match        *://*/camera/*
// @match        http://localhost:8081/*
// @include      *://*/
// @connect      www.googleapis.com
// @connect      apis.google.com
// @connect      accounts.google.com
// @connect      content.googleapis.com
// @icon         https://www.axis.com/themes/custom/axiscom/favicon.ico
// @supportURL   https://github.com/scharinger/userscripts/issues/new?labels=bug&projects=scharinger/1
// @updateURL    https://raw.githubusercontent.com/scharinger/userscripts/main/scripts/cloud-share.js
// @downloadURL  https://raw.githubusercontent.com/scharinger/userscripts/main/scripts/cloud-share.js
// @grant        GM_xmlhttpRequest
// ==/UserScript==

console.log("[Dev mode] Script loaded");

// ==== Google Drive konfiguration ====
// OAuth 2.0 utan gapi - använder direkt API-anrop
const CLIENT_ID = '319134209137-8jqkfmjct00cpbflffujulrtvuj6n8e2.apps.googleusercontent.com';
const REDIRECT_URI = 'https://scharinger.github.io/userscripts/oauth.html'; // GitHub Pages redirect
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

let accessToken = null;

// OAuth 2.0 Implicit Flow - öppnar popup för inloggning med postMessage
async function authenticateUser() {
    return new Promise((resolve, reject) => {
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
            `client_id=${CLIENT_ID}&` +
            `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
            `scope=${encodeURIComponent(SCOPES)}&` +
            `response_type=token&` +
            `state=${Math.random().toString(36)}`;

        console.log('[Dev mode] Öppnar OAuth popup med postMessage...');
        const popup = window.open(authUrl, 'oauth', 'width=500,height=600');

        // Lyssna på meddelanden från redirect-sidan
        const messageListener = (event) => {
            // Kontrollera att meddelandet kommer från rätt origin
            if (event.origin !== 'https://scharinger.github.io') {
                return;
            }

            window.removeEventListener('message', messageListener);

            if (event.data.access_token) {
                console.log('[Dev mode] OAuth token mottagen via postMessage');
                accessToken = event.data.access_token;
                popup.close();
                resolve(accessToken);
            } else if (event.data.error) {
                popup.close();
                reject(new Error('OAuth fel: ' + event.data.error));
            }
        };

        window.addEventListener('message', messageListener);

        // Kontrollera om popup stängdes manuellt
        const checkClosed = setInterval(() => {
            if (popup.closed) {
                clearInterval(checkClosed);
                window.removeEventListener('message', messageListener);
                reject(new Error('OAuth popup stängdes'));
            }
        }, 1000);

        // Timeout efter 5 minuter
        setTimeout(() => {
            clearInterval(checkClosed);
            window.removeEventListener('message', messageListener);
            if (!popup.closed) {
                popup.close();
            }
            reject(new Error('OAuth timeout'));
        }, 300000);
    });
}

async function ensureAuthenticated() {
    if (!accessToken) {
        accessToken = await authenticateUser();
    }
    return accessToken;
}

function base64ToUint8Array(b64) {
    const byteString = atob(b64);
    const ia = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
    return ia;
}

async function uploadToDrivePng(base64Payload) {
    const token = await ensureAuthenticated();

    const fileName = 'axis-share-' + new Date().toISOString().replace(/[:.]/g, '-') + '.png';
    const metadata = { name: fileName, mimeType: 'image/png' };
    const pngBytes = base64ToUint8Array(base64Payload);
    const boundary = '-------314159265358979323846';
    const delimiter = '\r\n--' + boundary + '\r\n';
    const closeDelim = '\r\n--' + boundary + '--';

    const multipartBody =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) + '\r\n' +
        delimiter +
        'Content-Type: image/png\r\n' +
        'Content-Transfer-Encoding: base64\r\n\r\n' +
        btoa(String.fromCharCode.apply(null, pngBytes)) +
        closeDelim;

    const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id%2CwebViewLink%2CwebContentLink';
    console.log('[Dev mode] Laddar upp till Google Drive...');
    const resp = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'multipart/related; boundary=' + boundary
        },
        body: multipartBody
    });
    if (!resp.ok) {
        const t = await resp.text();
        throw new Error('Drive upload misslyckades: ' + resp.status + ' ' + t);
    }
    const json = await resp.json();
    console.log('[Dev mode] Drive upload svar:', json);

    // Gör filen publik (valfritt). För detta krävs ytterligare request.
    try {
        const permResp = await fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(json.id) + '/permissions?fields=id', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ role: 'reader', type: 'anyone' })
        });
        if (!permResp.ok) {
            console.warn('[Dev mode] Kunde inte göra fil publik:', await permResp.text());
        } else {
            console.log('[Dev mode] Fil gjord publik');
        }
    } catch (e) {
        console.warn('[Dev mode] Fel vid public permission:', e);
    }

    // webViewLink/webContentLink kan vara undefined tills permission satt
    return json.webViewLink || json.webContentLink || ('https://drive.google.com/file/d/' + json.id + '/view');
}

// Helper: are we on the recordings view (hash-based router)?
function isRecordingsView() {
    return location.hash.startsWith('#/recordings');
}

let lastHash = location.hash;
function onHashMaybeChanged() {
    if (location.hash !== lastHash) {
        lastHash = location.hash;
        console.log('[Dev mode] Hash changed ->', lastHash);
        if (isRecordingsView()) {
            // Defer slightly to allow DOM to render
            setTimeout(() => {
                console.log('[Dev mode] Hash indicates recordings view, attempting injectShareButton');
                injectShareButton();
            }, 150);
        }
    }
}
window.addEventListener('hashchange', onHashMaybeChanged, false);
// Also poll as fallback (some single-page apps manipulate history silently)
setInterval(onHashMaybeChanged, 1000);

const base64image =
    `data:image/png;base64,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`

console.log("[Dev Cloud Share] Script executing");


// Inject panel when DOM is ready
// Panel is now only shown when Share is clicked

// Find the export button (change selector if needed)
function findExportButton() {
    // Find any button with text "Export" visible on the page
    const buttons = document.querySelectorAll("button");
    for (const btn of buttons) {
        if (btn.textContent.trim() === "Export") {
            return btn;
        }
    }
    return null;
}

// Create the Share button element
function createShareButton() {
    const shareBtn = document.createElement("button");
    shareBtn.textContent = "Share";
    shareBtn.style.marginLeft = "8px";
    shareBtn.className = "cloud-share-btn";
    shareBtn.onclick = openShareModal;
    return shareBtn;
}

// Open the share modal dialog
function openShareModal() {
    // Add the image to .sc-bHnlcS when Share is clicked
    console.log('[Dev mode] Share-knapp klickad, lägger till bild...');
    const img = document.createElement('img');
    img.src = base64image;
    img.alt = 'Base64 Image';
    img.style.maxWidth = '200px';
    img.style.maxHeight = '200px';
    img.style.margin = '12px';
    const targetDiv = document.querySelector('.sc-bHnlcS');
    if (targetDiv) {
        targetDiv.innerHTML = '';
        targetDiv.appendChild(img);
        console.log('[Dev mode] Bild ersatte innehållet i .sc-bHnlcS');
    } else {
        document.body.innerHTML = '';
        document.body.appendChild(img);
        console.log('[Dev mode] .sc-bHnlcS hittades inte, bild ersatte sidans innehåll');
    }

    // Ny: ladda upp till Google Drive (gapi)
    const base64Data = base64image.split(',')[1];
    (async () => {
        try {
            const link = await uploadToDrivePng(base64Data);
            alert('Drive upload OK: ' + link);
            console.log('[Dev mode] Delningslänk (ev. efter permission propagation):', link);
        } catch (e) {
            console.error('[Dev mode] Drive upload fel:', e);
            alert('Drive upload fel: ' + e);
        }
    })();
}

// Inject the Share button next to the Export button
function injectShareButton() {
    if (!isRecordingsView()) {
        // Avoid injecting on non-recordings views
        return;
    }
    const exportBtn = findExportButton();
    if (exportBtn && !document.querySelector(".cloud-share-btn")) {
        exportBtn.parentNode.insertBefore(
            createShareButton(),
            exportBtn.nextSibling
        );
        console.log('[Dev mode] Share-knapp injicerad');
    }
}

// Wait until DOM is ready
document.addEventListener("DOMContentLoaded", () => {
    console.log('[Dev mode] DOMContentLoaded');
    if (isRecordingsView()) {
        injectShareButton();
    } else {
        console.log('[Dev mode] Inte på recordings-vy ännu (hash=' + location.hash + ')');
    }
});

// Use MutationObserver to rerun injectShareButton when DOM changes
const observer = new MutationObserver(() => {
    const now = performance.now();
    if (!window.__cloudShareLastDomLog || now - window.__cloudShareLastDomLog > 1500) {
        window.__cloudShareLastDomLog = now;
        console.log("[Dev mode] DOM changed, re-evaluating...");
    }
    if (!document.querySelector('.cloud-share-btn')) {
        injectShareButton();
    }
});
observer.observe(document.body, { childList: true, subtree: true });
