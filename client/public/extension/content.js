// Segnala la presenza dell'estensione alla pagina web (DOM + Window property)
document.documentElement.setAttribute('data-gromit-bridge-active', 'true');

try {
    // Tenta di iniettare uno script nella pagina per settare la window property
    const script = document.createElement('script');
    script.textContent = 'window.__GROMIT_BRIDGE_ACTIVE__ = true;';
    (document.head || document.documentElement).appendChild(script);
    script.remove();
} catch (e) {
    console.warn('[GromitBridge] Impossibile settare window property, uso fallback DOM.');
}

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

console.log('[GromitBridge] Content Script attivo e pronto.');
