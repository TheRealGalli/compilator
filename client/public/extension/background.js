const BRIDGE_VERSION = "3.2.0"; // Full-Doc Edition

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'GET_VERSION') {
        sendResponse({ version: BRIDGE_VERSION });
        return false;
    }

    if (request.type === 'OLLAMA_FETCH') {
        handleStandardFetch(request, sendResponse);
        return true;
    }

    if (request.type === 'OLLAMA_PII_TURBO') {
        handleTurboExtraction(request, sendResponse);
        return true;
    }
});

async function handleStandardFetch(request, sendResponse) {
    const { url, options } = request;
    const fetchOptions = {
        method: options.method || 'GET',
        headers: { 'Content-Type': 'application/json' },
        body: options.body,
        mode: 'cors'
    };

    try {
        const response = await fetch(url, fetchOptions);
        const data = await response.json().catch(() => ({}));
        sendResponse({ success: true, ok: response.ok, status: response.status, data });
    } catch (error) {
        sendResponse({ success: false, error: error.message });
    }
}

async function handleTurboExtraction(request, sendResponse) {
    const { text, url, model, systemPrompt } = request;

    console.log(`[GromitFullDoc] Avvio estrazione PII (Testo: ${text.length} char)...`);

    try {
        const response = await fetch(`${url}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `<INPUT_DATA>\n${text}\n</INPUT_DATA>` }
                ],
                stream: false,
                options: {
                    temperature: 0.1,
                    num_ctx: 32768, // Ampia finestra per gestire interi documenti in un colpo solo
                    num_predict: 2048,
                    stop: ["</INPUT_DATA>", "[LABEL] ["]
                }
            })
        });

        if (!response.ok) {
            sendResponse({ success: false, error: `Ollama error: ${response.status}` });
            return;
        }

        const data = await response.json();
        const content = data.message?.content || "";

        // Parser linea per linea
        const allFindings = [];
        const seenKeys = new Set();

        for (const line of content.split('\n')) {
            const match = line.match(/^\[([A-Z_]+)\]\s*(.*)$/);
            if (match) {
                const val = match[2].trim();
                // Filtro per allucinazioni e pulizia tag
                if (val.length > 2 && !val.includes('[') && !val.includes(']')) {
                    const key = `${val.toLowerCase()}|${match[1]}`;
                    if (!seenKeys.has(key)) {
                        allFindings.push({ category: match[1].toUpperCase(), value: val });
                        seenKeys.add(key);
                    }
                }
            }
        }

        console.log(`[GromitFullDoc] Completato! Elementi trovati: ${allFindings.length}`);
        sendResponse({ success: true, findings: allFindings });

    } catch (err) {
        console.error("[GromitFullDoc] Errore critico:", err);
        sendResponse({ success: false, error: err.message });
    }
}
