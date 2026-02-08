// In ascolto di eventi dalla pagina web
window.addEventListener('GROMIT_BRIDGE_REQUEST', (event) => {
    const { detail, requestId } = event.detail;

    // Inoltra il messaggio al background script dell'estensione
    chrome.runtime.sendMessage(detail, (response) => {
        // Restituisce la risposta alla pagina web tramite un altro evento
        window.dispatchEvent(new CustomEvent('GROMIT_BRIDGE_RESPONSE', {
            detail: { response, requestId }
        }));
    });
});

console.log('[GromitBridge] Content Script attivo.');
