// Segnala la presenza dell'estensione alla pagina web tramite attributo DOM
// Più sicuro e compatibile con le CSP restrittive
document.documentElement.setAttribute('data-gromit-bridge-active', 'true');
console.log('[GromitBridge] Content Script inizializzato.');

// --- SESSION LIFECYCLE MANAGEMENT ---
// Establish a long-lived connection to keep the extension context alive (and detect closure)
const sessionPort = chrome.runtime.connect({ name: "GROMIT_SESSION" });

// In ascolto di eventi dalla pagina web
window.addEventListener('GROMIT_BRIDGE_REQUEST', (event: any) => {
    const { detail, requestId } = event.detail;

    // Helper to send message with optional retry
    const sendWithRetry = (retry = true) => {
        try {
            chrome.runtime.sendMessage(detail, (response) => {
                if (chrome.runtime.lastError) {
                    const error = chrome.runtime.lastError.message;
                    console.warn(`[GromitBridge] Message error: ${error}`);

                    if (retry && error?.includes('Could not establish connection')) {
                        console.log('[GromitBridge] Retrying message in 500ms...');
                        setTimeout(() => sendWithRetry(false), 500);
                        return;
                    }

                    // Respond with error if no retry or other error
                    window.dispatchEvent(new CustomEvent('GROMIT_BRIDGE_RESPONSE', {
                        detail: { response: { success: false, error }, requestId }
                    }));
                    return;
                }

                // Success: Restituisce la risposta alla pagina web
                window.dispatchEvent(new CustomEvent('GROMIT_BRIDGE_RESPONSE', {
                    detail: { response, requestId }
                }));
            });
        } catch (err: any) {
            console.error('[GromitBridge] Send Exception:', err);
            window.dispatchEvent(new CustomEvent('GROMIT_BRIDGE_RESPONSE', {
                detail: { response: { success: false, error: err.message }, requestId }
            }));
        }
    };

    sendWithRetry();
});

console.log('[GromitBridge] Content Script attivo e pronto. Session Port aperta.');
