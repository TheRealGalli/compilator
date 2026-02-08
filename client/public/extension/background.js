chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'OLLAMA_FETCH') {
        const { url, options } = request;

        console.log('[GromitBridge] Eseguo fetch (Background):', url);

        // Puliamo le opzioni per evitare che headers come 'Origin' o 'Referer' 
        // della pagina originale vengano passati a Ollama (causando 403)
        const fetchOptions = {
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            body: options.body,
            mode: 'cors',
            credentials: 'omit',
            referrerPolicy: 'no-referrer'
        };

        // Eseguiamo la fetch dal contesto dell'estensione (privilegiato)
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

        return true; // Mantiene il canale aperto
    }
});
