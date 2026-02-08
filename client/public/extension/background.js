chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'OLLAMA_FETCH') {
        const { url, options } = request;

        console.log('[GromitBridge] Eseguo fetch (Background):', url);

        // La fetch fatta qui non è soggetta a CORS o Mixed Content
        fetch(url, options)
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

        return true; // Mantiene il canale aperto per la risposta asincrona
    }
});
