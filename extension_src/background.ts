/// <reference types="chrome"/>

// Gromit Bridge Background Script v4.0.0 (Unified Sanctuary - Offscreen)
// Supports: OLLAMA_FETCH, EXTRACT_AND_ANALYZE (Proxied), GET_VERSION

const BRIDGE_VERSION = '4.0.0';
const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';

// --- OFFSCREEN DOCUMENT MANAGEMENT ---

let creating: Promise<void> | null = null; // A global promise to avoid concurrency issues

async function setupOffscreenDocument(path: string) {
    // Check if an offscreen document has already been created
    const offscreenUrl = chrome.runtime.getURL(path);
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
        documentUrls: [offscreenUrl]
    });

    if (existingContexts.length > 0) {
        return;
    }

    // create offscreen document
    if (creating) {
        await creating;
    } else {
        creating = chrome.offscreen.createDocument({
            url: path,
            reasons: [chrome.offscreen.Reason.DOM_PARSER],
            justification: 'Parsing PDF and other document formats requires a full DOM environment.'
        });
        await creating;
        creating = null;
    }
}

chrome.runtime.onMessage.addListener((request: any, sender: any, sendResponse: any) => {

    // --- GET_VERSION: Returns bridge version ---
    if (request.type === 'GET_VERSION') {
        sendResponse({ version: BRIDGE_VERSION });
        return true;
    }

    // --- EXTRACT_AND_ANALYZE: The new "Sanctuary" logic (via Offscreen) ---
    if (request.type === 'EXTRACT_AND_ANALYZE') {
        (async () => {
            try {
                await setupOffscreenDocument(OFFSCREEN_DOCUMENT_PATH);

                // Forward message to offscreen document
                console.log('[GromitBridge] Forwarding extraction request to Offscreen Document...');
                const response = await chrome.runtime.sendMessage({
                    type: 'EXTRACT_FROM_OFFSCREEN',
                    fileBase64: request.fileBase64,
                    fileName: request.fileName,
                    fileType: request.fileType
                });

                sendResponse(response);
            } catch (error: any) {
                console.error('[GromitBridge] Offscreen Proxy Error:', error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true; // Keep channel open
    }

    // --- OLLAMA_FETCH: Simple fetch proxy ---
    if (request.type === 'OLLAMA_FETCH') {
        const { url, options } = request;

        console.log('[GromitBridge] Eseguo fetch (Background):', url);

        const fetchOptions: any = {
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            body: options.body,
            mode: 'cors',
            credentials: 'omit',
            referrerPolicy: 'no-referrer'
        };

        fetch(url, fetchOptions)
            .then(async response => {
                const ok = response.ok;
                const status = response.status;
                const data = await response.json().catch(() => ({}));
                sendResponse({ success: true, ok, status, data });
            })
            .catch(error => {
                console.error('[GromitBridge] Errore Fetch:', error);
                sendResponse({ success: false, error: error.message });
            });

        return true;
    }

});
