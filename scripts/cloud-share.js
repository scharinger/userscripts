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
const UPLOAD_FOLDER_NAME = 'Axis camera video clips';
let uploadFolderId = null;
// Feature flag: ska vi automatiskt göra filer publika direkt efter upload?
// Sätt till true om du vill behålla gamla beteendet. Nu default = false för bättre säkerhet.
const AUTO_PUBLIC_PERMISSION = false;

// Tider för feedback (ms)
const SHARE_SUCCESS_ICON_MS = 4200; // Hur länge bock-ikonen visas
const SHARE_LINK_VISIBLE_MS = 4200; // Hur länge Drive-länken visas

// SVG helpers måste ligga före createShareButton och openShareModal
function getShareIconSVG() {
    return `<svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15.5 13.5C14.67 13.5 13.92 13.84 13.38 14.38L7.91 11.13C7.97 10.77 8 10.39 8 10C8 9.61 7.97 9.23 7.91 8.87L13.28 5.68C13.84 6.19 14.62 6.5 15.5 6.5C16.88 6.5 18 5.38 18 4C18 2.62 16.88 1.5 15.5 1.5C14.12 1.5 13 2.62 13 4C13 4.39 13.07 4.76 13.19 5.09L7.82 8.28C7.26 7.77 6.48 7.5 5.5 7.5C4.12 7.5 3 8.62 3 10C3 11.38 4.12 12.5 5.5 12.5C6.48 12.5 7.26 12.23 7.82 11.72L13.19 14.91C13.07 15.24 13 15.61 13 16C13 17.38 14.12 18.5 15.5 18.5C16.88 18.5 18 17.38 18 16C18 14.62 16.88 13.5 15.5 13.5Z" stroke="#444" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function getCheckIconSVG() {
    return `<svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 10.5L9 14.5L15 7.5" stroke="#2ca02c" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

// ==== Google Drive konfiguration ====
// Skapa eller hämta mapp med namn UPLOAD_FOLDER_NAME
async function getOrCreateUploadFolder(token) {
    if (uploadFolderId) return uploadFolderId;
    // Sök efter mappen
    const query = `name='${UPLOAD_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`;
    const resp = await fetch(searchUrl, {
        headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!resp.ok) throw new Error('Kunde inte söka efter mapp: ' + await resp.text());
    const data = await resp.json();
    if (data.files && data.files.length > 0) {
        uploadFolderId = data.files[0].id;
        return uploadFolderId;
    }
    // Skapa mappen om den inte finns
    const createResp = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: UPLOAD_FOLDER_NAME,
            mimeType: 'application/vnd.google-apps.folder'
        })
    });
    if (!createResp.ok) throw new Error('Kunde inte skapa mapp: ' + await createResp.text());
    const folder = await createResp.json();
    uploadFolderId = folder.id;
    return uploadFolderId;
}
// OAuth 2.0 utan gapi - använder direkt API-anrop
const CLIENT_ID = '319134209137-8jqkfmjct00cpbflffujulrtvuj6n8e2.apps.googleusercontent.com';
let accessToken = null;

async function authenticateUser() {
    return new Promise((resolve, reject) => {
        const redirect = 'https://scharinger.github.io/userscripts/oauth.html';
        const scope = encodeURIComponent('https://www.googleapis.com/auth/drive.file');
        const state = encodeURIComponent(location.origin);
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(redirect)}&response_type=token&scope=${scope}&include_granted_scopes=true&state=${state}`;

        const popup = window.open(authUrl, 'axis-drive-auth', 'width=520,height=640,scrollbars=yes,resizable=yes');
        if (!popup) {
            reject(new Error('Kunde inte öppna popup (blockerad av webbläsaren?)'));
            return;
        }
        let resolved = false;
        const timeout = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                try { popup.close(); } catch (_) { }
                reject(new Error('Timeout vid autentisering'));
            }
        }, 1000 * 60); // 60s

        function cleanup() {
            clearTimeout(timeout);
            window.removeEventListener('message', onMsg);
        }
        function onMsg(event) {
            // Tillåt wildcard eftersom GitHub pages kör på origin https://scharinger.github.io
            if (event.origin !== 'https://scharinger.github.io') return;
            const d = event.data || {};
            if (d.type === 'OAUTH_SUCCESS') {
                if (resolved) return;
                resolved = true;
                cleanup();
                try { popup.close(); } catch (_) { }
                resolve(d.token);
            } else if (d.type === 'OAUTH_ERROR') {
                if (resolved) return;
                resolved = true;
                cleanup();
                try { popup.close(); } catch (_) { }
                reject(new Error(d.error || 'oauth_error'));
            } else if (d.access_token) {
                // Backwards compatibility if older oauth.html still sends bare token
                if (resolved) return;
                resolved = true;
                cleanup();
                try { popup.close(); } catch (_) { }
                resolve(d.access_token);
            }
        }
        window.addEventListener('message', onMsg);
    });
}

async function uploadToDrivePng(base64Payload) {
    const token = await ensureAuthenticated();
    const folderId = await getOrCreateUploadFolder(token);

    const fileName = 'axis-share-' + new Date().toISOString().replace(/[:.]/g, '-') + '.png';
    const metadata = {
        name: fileName,
        mimeType: 'image/png',
        parents: [folderId]
    };
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
    console.log('[Dev mode] Laddar upp till Google Drive-mapp...');
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
    if (AUTO_PUBLIC_PERMISSION) {
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
    } else {
        console.log('[Dev mode] AUTO_PUBLIC_PERMISSION=false -> filen lämnas privat (endast autentiserad användare kan se).');
    }

    // webViewLink/webContentLink kan vara undefined tills permission satt
    return json.webViewLink || json.webContentLink || ('https://drive.google.com/file/d/' + json.id + '/view');
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
                injectShareButton(0, true); // Force injection on hash change
            }, 150);
        }
    }
}
window.addEventListener('hashchange', onHashMaybeChanged, false);
// Also poll as fallback (some single-page apps manipulate history silently)
setInterval(onHashMaybeChanged, 1000);

// Also trigger on initial load if we're already in recordings view
if (isRecordingsView()) {
    setTimeout(() => {
        console.log('[Dev mode] Initial load in recordings view, attempting injectShareButton');
        injectShareButton();
    }, 500);
}

const base64image =
    `data:image/png;base64,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`


console.log("[Dev Cloud Share] Script executing");

// Function to replace target div with image only
function replaceTargetWithImage() {
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

        // Force re-injection of Share button (reset the check)
        setTimeout(() => {
            console.log('[Dev mode] Försöker injicera Share-knapp efter bildersättning...');
            injectShareButton(0, true); // Force re-injection
        }, 200);
    } else {
        console.log('[Dev mode] .sc-bHnlcS hittades inte ännu, väntar...');
        // Try again after a short delay
        setTimeout(replaceTargetWithImage, 500);
    }
}

// Start trying to replace the target div when script loads
replaceTargetWithImage();// --- Share button logic (upload only on click) ---
function findExportButton() {
    // Försök hitta en knapp som innehåller "Export" (case-insensitive)
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
        const txt = (btn.textContent || '').trim();
        if (/export/i.test(txt)) {
            return btn;
        }
    }
    return null;
}

function createShareButton(referenceBtn = null) {
    // Skapa en transparent, ikon-only knapp likt soptunnan
    const shareBtn = document.createElement('button');
    shareBtn.className = 'cloud-share-btn';
    shareBtn.title = 'Dela till molnet';
    shareBtn.style.background = 'none';
    shareBtn.style.border = 'none';
    shareBtn.style.padding = '4px';
    shareBtn.style.marginRight = '4px';
    shareBtn.style.cursor = 'pointer';
    shareBtn.style.opacity = '0.7';
    shareBtn.style.display = 'flex';
    shareBtn.style.alignItems = 'center';
    shareBtn.style.justifyContent = 'center';
    shareBtn.style.transition = 'opacity 0.2s';
    shareBtn.onmouseover = () => shareBtn.style.opacity = '1';
    shareBtn.onmouseout = () => shareBtn.style.opacity = '0.7';
    shareBtn.innerHTML = getShareIconSVG();
    function getShareIconSVG() {
        return `<svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15.5 13.5C14.67 13.5 13.92 13.84 13.38 14.38L7.91 11.13C7.97 10.77 8 10.39 8 10C8 9.61 7.97 9.23 7.91 8.87L13.28 5.68C13.84 6.19 14.62 6.5 15.5 6.5C16.88 6.5 18 5.38 18 4C18 2.62 16.88 1.5 15.5 1.5C14.12 1.5 13 2.62 13 4C13 4.39 13.07 4.76 13.19 5.09L7.82 8.28C7.26 7.77 6.48 7.5 5.5 7.5C4.12 7.5 3 8.62 3 10C3 11.38 4.12 12.5 5.5 12.5C6.48 12.5 7.26 12.23 7.82 11.72L13.19 14.91C13.07 15.24 13 15.61 13 16C13 17.38 14.12 18.5 15.5 18.5C16.88 18.5 18 17.38 18 16C18 14.62 16.88 13.5 15.5 13.5Z" stroke="#444" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    }

    function getCheckIconSVG() {
        return `<svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 10.5L9 14.5L15 7.5" stroke="#2ca02c" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    }
    shareBtn.addEventListener('click', openShareModal, { once: false });
    return shareBtn;
}

function openShareModal() {
    console.log('[Dev mode] Share-knapp klickad: initierar exportflöde...');
    (async () => {
        // Hämta referens till Share-knappen
        const shareBtn = document.querySelector('.cloud-share-btn');
        // Hämta/lägg till länkcontainer under wrapper
        let linkDiv = null;
        const wrapper = shareBtn ? shareBtn.closest('.cloud-share-wrapper') : null;
        if (wrapper) {
            linkDiv = wrapper.querySelector('.cloud-share-link-div');
            if (!linkDiv) {
                linkDiv = document.createElement('div');
                linkDiv.className = 'cloud-share-link-div';
                linkDiv.style.display = 'block';
                linkDiv.style.width = '100%';
                linkDiv.style.fontSize = '13px';
                linkDiv.style.marginTop = '6px';
                linkDiv.style.padding = '6px 8px';
                linkDiv.style.borderRadius = '6px';
                linkDiv.style.background = 'rgba(240,240,245,0.95)';
                linkDiv.style.border = '1px solid #e0e0e0';
                linkDiv.style.boxShadow = '0 1px 4px 0 rgba(0,0,0,0.04)';
                linkDiv.style.wordBreak = 'break-all';
                linkDiv.style.opacity = '0.92';
                linkDiv.style.textAlign = 'left';
                linkDiv.style.position = 'relative';
                wrapper.appendChild(linkDiv);
            }
            linkDiv.textContent = '';
        }
        // Viktigt: autentisera DIREKT i klickhändelsen innan vi gör tunga async (för att undvika popup-blocker)
        if (!accessToken) {
            try {
                console.log('[Dev mode] Initierar autentisering direkt vid klick...');
                await ensureAuthenticated();
                console.log('[Dev mode] Autentisering klar (token erhållen).');
            } catch (authErr) {
                if (shareBtn) shareBtn.innerHTML = getShareIconSVG();
                if (linkDiv) linkDiv.textContent = '';
                console.error('[Dev mode] Autentisering misslyckades (avbryter flöde):', authErr);
                alert('Kunde inte autentisera mot Google Drive (popup blockerad eller avbruten). Tillåt popup och försök igen.');
                return; // Avbryt hela share-flödet
            }
        } else {
            // Token redan finns
            console.log('[Dev mode] Återanvänder existerande accessToken.');
        }

        let meta;
        try {
            meta = getRecordingMetadata();
            console.log('[Dev mode] Metadata extraherad:', meta);
        } catch (e) {
            console.warn('[Dev mode] Kunde inte hämta metadata – fallback till bild:', e);
        }

        if (!meta || !meta.recordingId || !meta.fromParts || !meta.toParts) {
            console.warn('[Dev mode] Ofullständig metadata, använder fallback-bild.');
            const base64Data = base64image.split(',')[1];
            try {
                const link = await uploadToDrivePng(base64Data);
                if (shareBtn) shareBtn.innerHTML = getCheckIconSVG();
                if (linkDiv) linkDiv.innerHTML = `<a href="${link}" target="_blank" rel="noopener" style="color:#1976d2;text-decoration:underline;font-weight:500;transition:color 0.2s;">Drive-länk (bild)</a>`;
                setTimeout(() => {
                    if (shareBtn) shareBtn.innerHTML = getShareIconSVG();
                }, SHARE_SUCCESS_ICON_MS);
                setTimeout(() => {
                    if (linkDiv) linkDiv.textContent = '';
                }, SHARE_LINK_VISIBLE_MS);
                alert('Drive upload OK (bild fallback): ' + link);
                return;
            } catch (e) {
                if (shareBtn) shareBtn.innerHTML = getShareIconSVG();
                if (linkDiv) linkDiv.textContent = '';
                console.error('[Dev mode] Fallback upload misslyckades:', e);
                alert('Upload fel: ' + e);
                return;
            }
        }

        try {
            const exportInfo = buildExportUrl(meta, { padSeconds: 1 });
            console.log('[Dev mode] Export URL byggd:', exportInfo.url, exportInfo.params);
            const blob = await fetchRecordingBlob(exportInfo.url);
            console.log('[Dev mode] Export fetch klar. Storlek ~' + (blob.size / 1024 / 1024).toFixed(2) + ' MB');

            const filenameBase = sanitizeFilename(meta.filename || meta.recordingId || 'recording');
            const driveFilename = filenameBase + '.mkv'; // behåll originalformat (.mkv)
            console.log('[Dev mode] Laddar upp video till Drive som', driveFilename);
            const link = await uploadToDriveFile(blob, driveFilename, 'video/x-matroska');
            if (shareBtn) shareBtn.innerHTML = getCheckIconSVG();
            if (linkDiv) linkDiv.innerHTML = `<a href="${link}" target="_blank" rel="noopener" style="color:#1976d2;text-decoration:underline;font-weight:500;transition:color 0.2s;">Drive-länk (video)</a>`;
            setTimeout(() => {
                if (shareBtn) shareBtn.innerHTML = getShareIconSVG();
            }, SHARE_SUCCESS_ICON_MS);
            setTimeout(() => {
                if (linkDiv) linkDiv.textContent = '';
            }, SHARE_LINK_VISIBLE_MS);
            alert('Video uppladdad: ' + link);
            console.log('[Dev mode] Delningslänk:', link);
        } catch (e) {
            if (shareBtn) shareBtn.innerHTML = getShareIconSVG();
            if (linkDiv) linkDiv.textContent = '';
            console.error('[Dev mode] Export/video-flöde misslyckades, försöker fallback-bild:', e);
            try {
                const base64Data = base64image.split(',')[1];
                const link = await uploadToDrivePng(base64Data);
                if (shareBtn) shareBtn.innerHTML = getCheckIconSVG();
                if (linkDiv) linkDiv.innerHTML = `<a href="${link}" target="_blank" rel="noopener">Drive-länk (bild)</a>`;
                setTimeout(() => {
                    if (shareBtn) shareBtn.innerHTML = getShareIconSVG();
                    if (linkDiv) linkDiv.textContent = '';
                }, 4200);
                alert('Video misslyckades, bild uppladdad istället: ' + link);
            } catch (e2) {
                if (shareBtn) shareBtn.innerHTML = getShareIconSVG();
                if (linkDiv) linkDiv.textContent = '';
                console.error('[Dev mode] Även fallback-bild misslyckades:', e2);
                alert('Delning misslyckades: ' + e2);
            }
        }
    })();
}

let mutationObserverStarted = false;
function injectShareButton(retryCount = 0, force = false) {
    const exportBtn = findExportButton();
    if (exportBtn) {
        wrapExportAndEnsureShare(exportBtn, force);
    } else if (retryCount < 15) {
        if (retryCount === 0) {
            const texts = [...document.querySelectorAll('button')].map(b => (b.textContent || '').trim()).filter(Boolean);
            console.log('[Dev mode] Hittar ännu ingen Export-knapp. Befintliga knapptexter:', texts);
        }
        setTimeout(() => injectShareButton(retryCount + 1, force), 400);
    } else {
        const targetDiv = document.querySelector('.sc-bHnlcS');
        // Om targetDiv bara innehåller en bild, injicera INTE Share-knapp
        if (targetDiv && !document.querySelector('.cloud-share-btn')) {
            const onlyImg = targetDiv.childNodes.length === 1 && targetDiv.firstElementChild && targetDiv.firstElementChild.tagName === 'IMG';
            if (onlyImg) {
                console.log('[Dev mode] Ingen Export-knapp och endast bild i targetDiv – Share-knapp injiceras INTE.');
                return;
            }
            targetDiv.appendChild(createShareButton());
            console.log('[Dev mode] Fallback: Share-knapp injicerad i targetDiv (Export hittades aldrig)');
        }
    }

    // Starta MutationObserver en gång för att reagera när Export-knappen dyker upp
    if (!mutationObserverStarted) {
        mutationObserverStarted = true;
        window.__shareObserver = new MutationObserver((mutations) => {
            let shouldInject = false;
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    // Check if any new Export buttons were added
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === 1) { // Element node
                            const exportBtn = node.querySelector ? node.querySelector('button') : null;
                            if (exportBtn && /export/i.test(exportBtn.textContent || '')) {
                                shouldInject = true;
                                break;
                            }
                        }
                    }
                }
                if (shouldInject) break;
            }

            // Also check if share button disappeared but export button exists
            if (!document.querySelector('.cloud-share-btn') && findExportButton()) {
                shouldInject = true;
            }

            if (shouldInject) {
                console.log('[Dev mode] MutationObserver detected DOM change, re-injecting Share button');
                setTimeout(() => injectShareButton(0, true), 100);
            }
        });
        try {
            window.__shareObserver.observe(document.body, { childList: true, subtree: true });
            console.log('[Dev mode] MutationObserver aktiv för Share-knapp');
        } catch (e) {
            console.warn('[Dev mode] Kunde inte starta MutationObserver:', e);
        }
    }
}

// Extra säkerhetsnät: försök igen efter 5 sek
setTimeout(() => {
    if (!document.querySelector('.cloud-share-btn')) {
        console.log('[Dev mode] Säkerhetsnät körs (5s)');
        injectShareButton();
    }
}, 5000);


// Always start injection and observer on DOMContentLoaded for React SPA reliability
document.addEventListener("DOMContentLoaded", () => {
    console.log('[Dev mode] DOMContentLoaded event');
    injectShareButton(0, true); // Force injection and start observer
});

// ---- Metadata extraction & helper logic ----
function getTextFollowing(labelText) {
    const labels = Array.from(document.querySelectorAll('p, label'));
    for (const el of labels) {
        if ((el.textContent || '').trim().toLowerCase() === labelText.toLowerCase()) {
            // For <p> pattern the nextElementSibling holds the value
            let sib = el.nextElementSibling;
            if (sib && sib.tagName === 'SPAN') return sib.textContent.trim();
            // For label+input areas we may need to look ahead
            if (el.tagName === 'LABEL') {
                // Next sibling container then inputs
                let container = el.nextElementSibling;
                if (!container) continue;
                const inputs = container.querySelectorAll('input');
                if (inputs.length > 0) return Array.from(inputs).map(i => i.value).join(' ');
            }
        }
    }
    return null;
}

function getRecordingMetadata() {
    const recordingId = getTextFollowing('Recording ID:');
    const diskId = getTextFollowing('Disk ID:');
    const fromValues = getRangeValues('From');
    const toValues = getRangeValues('To');
    const filenameInput = document.querySelector('input[name="filename"]');
    const filename = filenameInput ? filenameInput.value : null;
    return { recordingId, diskId, from: fromValues?.iso || null, to: toValues?.iso || null, fromParts: fromValues || null, toParts: toValues || null, filename };
}

function getRangeValues(label) {
    const labels = Array.from(document.querySelectorAll('label'));
    const target = labels.find(l => (l.textContent || '').trim().toLowerCase() === label.toLowerCase());
    if (!target) return null;
    let container = target.nextElementSibling; // div with two fields
    if (!container) return null;
    const inputs = container.querySelectorAll('input');
    if (inputs.length < 2) return null;
    const date = inputs[0].value;
    const time = inputs[1].value;
    if (!date || !time) return { date, time, iso: null };
    // Normalize time to HH:MM:SS if missing seconds
    let t = time.trim();
    if (/^\d{2}:\d{2}$/.test(t)) t += ':00';
    // Compose local ISO (without timezone adjustments) and also Date object
    const iso = new Date(date + 'T' + t).toISOString();
    return { date, time: t, iso };
}

// ---- Export URL construction & video fetch ----
function buildExportUrl(meta, { padSeconds = 0 } = {}) {
    // Parse local dates from parts (already normalized with seconds)
    const start = new Date(meta.fromParts.date + 'T' + meta.fromParts.time);
    const stop = new Date(meta.toParts.date + 'T' + meta.toParts.time);
    if (padSeconds) {
        start.setSeconds(start.getSeconds() - padSeconds);
        stop.setSeconds(stop.getSeconds() + padSeconds);
    }
    const startStr = formatLocalDateTimeWithOffset(start);
    const stopStr = formatLocalDateTimeWithOffset(stop);
    const filenameParam = sanitizeFilename(meta.filename || meta.recordingId || 'recording');
    const params = {
        schemaversion: '1',
        recordingid: meta.recordingId,
        diskid: meta.diskId || 'SD_DISK',
        exportformat: 'matroska',
        filename: filenameParam,
        starttime: startStr,
        stoptime: stopStr
    };
    const qs = Object.entries(params)
        .map(([k, v]) => k + '=' + encodeURIComponent(v).replace(/%20/g, '+'))
        .join('&');
    // Assume same origin (camera) – fallback to location.origin
    const base = location.origin;
    const url = base + '/axis-cgi/record/export/exportrecording.cgi?' + qs;
    return { url, params };
}

function formatLocalDateTimeWithOffset(d) {
    const pad = n => String(n).padStart(2, '0');
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const mins = pad(d.getMinutes());
    const secs = pad(d.getSeconds());
    const ms = '000';
    const offsetMin = -d.getTimezoneOffset(); // minutes east of UTC
    const sign = offsetMin >= 0 ? '+' : '-';
    const abs = Math.abs(offsetMin);
    const offH = pad(Math.floor(abs / 60));
    const offM = pad(abs % 60);
    return `${year}-${month}-${day}T${hours}:${mins}:${secs}.${ms}${sign}${offH}:${offM}`;
}

async function fetchRecordingBlob(url) {
    console.log('[Dev mode] Hämtar video från exportendpoint...');
    const resp = await fetch(url, { method: 'GET' });
    if (!resp.ok) {
        throw new Error('Export request misslyckades: ' + resp.status + ' ' + resp.statusText);
    }
    const contentLength = resp.headers.get('Content-Length');
    if (!resp.body || typeof resp.body.getReader !== 'function') {
        console.log('[Dev mode] Ingen stream, använder blob() direkt');
        return await resp.blob();
    }
    const reader = resp.body.getReader();
    const chunks = [];
    let received = 0;
    const total = contentLength ? parseInt(contentLength, 10) : null;
    let lastLog = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
            chunks.push(value);
            received += value.length;
            const now = performance.now();
            if (now - lastLog > 750) {
                if (total) {
                    console.log(`[Dev mode] Nedladdning ${((received / total) * 100).toFixed(1)}% (${(received / 1024 / 1024).toFixed(2)} MB / ${(total / 1024 / 1024).toFixed(2)} MB)`);
                } else {
                    console.log(`[Dev mode] Nedladdning ${(received / 1024 / 1024).toFixed(2)} MB (okänt total)`);
                }
                lastLog = now;
            }
        }
    }
    console.log('[Dev mode] Nedladdning klar, bygger Blob...');
    return new Blob(chunks, { type: 'video/x-matroska' });
}

function sanitizeFilename(name) {
    return (name || 'recording').replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 120);
}

async function uploadToDriveFile(blob, filename, mimeType) {
    const token = await ensureAuthenticated();
    const folderId = await getOrCreateUploadFolder(token);
    const metadata = { name: filename, mimeType, parents: [folderId] };

    // Multipart/related med binär del (ingen base64) – effektivare minne och snabbare
    const boundary = '-------axis-drive-upload-' + Math.random().toString(36).slice(2);
    const part1Header = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`;
    const part1Body = JSON.stringify(metadata) + '\r\n';
    const part2Header = `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`;
    const partClose = `\r\n--${boundary}--`;
    const multipartBlob = new Blob([
        part1Header,
        part1Body,
        part2Header,
        blob,
        partClose
    ], { type: 'multipart/related; boundary=' + boundary });

    console.log('[Dev mode] Startar Drive-upload (binär multipart). Storlek ~' + (multipartBlob.size / 1024 / 1024).toFixed(2) + ' MB');
    const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id%2CwebViewLink%2CwebContentLink';
    let resp = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': multipartBlob.type },
        body: multipartBlob
    });
    if (!resp.ok) {
        const text = await resp.text();
        console.warn('[Dev mode] Multipart binär upload misslyckades, försök fallback base64. Svar:', resp.status, text.slice(0, 300));
        // Fallback: base64 (endast om något oförutsett händer, t.ex. proxy fel)
        try {
            const base64Data = await blobToBase64(blob);
            const b2 = '-------fallback' + Math.random().toString(36).slice(2);
            const delimiter = '\r\n--' + b2 + '\r\n';
            const closeDelim = '\r\n--' + b2 + '--';
            const multipartBody =
                delimiter + 'Content-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata) + '\r\n' +
                delimiter + 'Content-Type: ' + mimeType + '\r\nContent-Transfer-Encoding: base64\r\n\r\n' + base64Data + closeDelim;
            resp = await fetch(uploadUrl, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'multipart/related; boundary=' + b2 },
                body: multipartBody
            });
            if (!resp.ok) {
                throw new Error('Fallback base64 misslyckades: ' + resp.status + ' ' + await resp.text());
            }
        } catch (fbErr) {
            throw new Error('Drive upload misslyckades (alla försök): ' + fbErr);
        }
    }
    const json = await resp.json();
    if (AUTO_PUBLIC_PERMISSION) {
        try {
            await fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(json.id) + '/permissions?fields=id', {
                method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: 'reader', type: 'anyone' })
            });
        } catch (e) {
            console.warn('[Dev mode] Kunde inte sätta public permission (video):', e);
        }
    } else {
        console.log('[Dev mode] AUTO_PUBLIC_PERMISSION=false -> videon lämnas privat.');
    }
    return json.webViewLink || json.webContentLink || ('https://drive.google.com/file/d/' + json.id + '/view');
}

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = reader.result;
            const idx = dataUrl.indexOf(',');
            resolve(idx >= 0 ? dataUrl.substring(idx + 1) : dataUrl);
        };
        reader.onerror = err => reject(err);
        reader.readAsDataURL(blob);
    });
}

// Wrap export button and ensure exactly one share button
function wrapExportAndEnsureShare(exportBtn, force = false) {
    // If already wrapped
    if (exportBtn.parentElement && exportBtn.parentElement.classList.contains('cloud-share-wrapper')) {
        dedupeShareButtons(exportBtn.parentElement);
        if (!exportBtn.parentElement.querySelector('.cloud-share-btn')) {
            // Lägg Share FÖRE Export
            exportBtn.parentElement.insertBefore(createShareButton(exportBtn), exportBtn);
            console.log('[Dev mode] Share-knapp tillagd före Export i existerande wrapper (saknades)');
        }
        return;
    }
    const parent = exportBtn.parentNode;
    if (!parent) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'cloud-share-wrapper';
    wrapper.style.display = 'inline-flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.gap = '4px';
    parent.insertBefore(wrapper, exportBtn);
    // Lägg Share FÖRE Export
    const shareBtn = createShareButton(exportBtn);
    wrapper.appendChild(shareBtn);
    wrapper.appendChild(exportBtn);
    // Move any pre-existing share buttons near export into wrapper (dedupe later)
    const strayShares = Array.from(parent.querySelectorAll('.cloud-share-btn'));
    strayShares.forEach(btn => wrapper.insertBefore(btn, wrapper.firstChild));
    dedupeShareButtons(wrapper);
    console.log('[Dev mode] Export inlindad i wrapper och Share säkerställd (Share före Export)');
}

function dedupeShareButtons(scopeEl) {
    const shares = Array.from(scopeEl.querySelectorAll('.cloud-share-btn'));
    if (shares.length <= 1) return;
    // Keep first, remove rest
    shares.slice(1).forEach(b => b.remove());
    console.log('[Dev mode] Borttog dubbletter av Share-knappar (' + (shares.length - 1) + ')');
}
