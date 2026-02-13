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

    // Inoltra il messaggio al background script dell'estensione
    chrome.runtime.sendMessage(detail, (response) => {
        // Restituisce la risposta alla pagina web tramite un altro evento
        window.dispatchEvent(new CustomEvent('GROMIT_BRIDGE_RESPONSE', {
            detail: { response, requestId }
        }));
    });
});

console.log('[GromitBridge] Content Script attivo e pronto. Session Port aperta.');
