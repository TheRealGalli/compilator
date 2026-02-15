/// <reference types="chrome"/>

// Gromit Bridge Background Script v5.3.3 (Hardware-Accelerated OCR)
// Supports: OLLAMA_FETCH, EXTRACT_AND_ANALYZE (Proxied), GET_VERSION

const BRIDGE_VERSION = '5.3.3';
const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';

// Global state
let activeSessions = 0;
let creating: Promise<void> | null = null;

// Handle long-lived connections from content scripts (GROMIT_SESSION)
chrome.runtime.onConnect.addListener((port) => {
    if (port.name === "GROMIT_SESSION") {
        console.log("[GromitBridge] ⚡ Session Port Connected.");
        activeSessions++;
        port.onDisconnect.addListener(() => {
            activeSessions--;
            console.log(`[GromitBridge] 📴 Session Port Disconnected (Remaining: ${activeSessions}).`);
            if (activeSessions <= 0) {
                closeOffscreenDocument();
            }
        });
    }
});

// --- LIFECYCLE MANAGEMENT (SESSION BASED) ---

async function closeOffscreenDocument() {
    if (!creating) {
        try {
            await chrome.offscreen.closeDocument();
            console.log(`[GromitBridge] 🛑 Offscreen Document Closed. Session Ended (Active Sessions: ${activeSessions}).`);
        } catch (err) {
            console.debug('[GromitBridge] Offscreen already closed or invalid.');
        }
    }
}



async function setupOffscreenDocument(path: string) {
    // Reset timer whenever we "touch" the offscreen doc


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
    // Refresh timer on any valid activity


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

    if (request.type === 'OLLAMA_FETCH') {
        const { url, options } = request;

        console.log(`[GromitBridge 5.1.0] Fetching: ${url}`);

        const fetchOptions: any = {
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            mode: 'cors',
            credentials: 'omit',
            referrerPolicy: 'no-referrer'
        };

        if (options.body && options.method !== 'GET') {
            fetchOptions.body = options.body;
        }

        fetch(url, fetchOptions)
            .then(async response => {
                const ok = response.ok;
                const status = response.status;
                const text = await response.text().catch(() => '');
                let data = {};
                try {
                    data = text ? JSON.parse(text) : {};
                } catch (e) {
                    data = { raw: text };
                }
                sendResponse({ success: true, ok, status, data });
            })
            .catch(error => {
                // SILENT CONNECTIVITY: Downgrade to debug for network errors (status 0)
                if (!error.status || error.status === 0) {
                    console.debug('[GromitBridge 5.1.0] Fetch failed (System Offline):', url);
                } else {
                    console.error('[GromitBridge 5.1.0] Fetch Error:', error);
                }
                sendResponse({
                    success: false,
                    error: error.message || 'Unknown Network Error',
                    status: 0
                });
            });

        return true;
    }

});
