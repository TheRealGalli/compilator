const BRIDGE_VERSION = "3.1.0"; // Surgical Parallel

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
    const CHUNK_SIZE = 8000;
    const OVERLAP = 1000;
    const CONCURRENCY = 2; // Ridotto a 2 per gestire meglio il parallelo multi-doc dell'M1

    console.log(`[GromitParallel] Avvio estrazione PII (Testo: ${text.length} char)...`);

    // Capture the first 1000 chars as Document Context for all chunks
    const docContext = text.substring(0, 1000);

    // 1. Chunking interno
    const chunks = [];
    for (let i = 0; i < text.length; i += (CHUNK_SIZE - OVERLAP)) {
        chunks.push(text.substring(i, i + CHUNK_SIZE));
        if (i + CHUNK_SIZE >= text.length) break;
    }

    const allFindings = [];
    const seenKeys = new Set();
    const knownValues = [];

    // 2. Esecuzione parallela a lotti
    for (let i = 0; i < chunks.length; i += CONCURRENCY) {
        const batch = chunks.slice(i, i + CONCURRENCY);

        const results = await Promise.all(batch.map(async (chunk) => {
            try {
                const response = await fetch(`${url}/api/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model,
                        messages: [
                            { role: 'system', content: systemPrompt + (knownValues.length > 0 ? `\n\nALREADY KNOWN: ${knownValues.slice(-50).join(', ')}` : "") },
                            { role: 'user', content: `[DOCUMENT PREAMBLE: ${docContext}...]\n\n<INPUT_DATA_CHUNK>\n${chunk}\n</INPUT_DATA_CHUNK>` }
                        ],
                        stream: false,
                        options: { temperature: 0.1, num_ctx: 16384, num_predict: 2048 }
                    })
                });

                if (!response.ok) return [];
                const data = await response.json();
                const content = data.message?.content || "";

                // Parser linea per linea
                const chunkFindings = [];
                for (const line of content.split('\n')) {
                    const match = line.match(/^\[([A-Z_]+)\]\s*(.*)$/);
                    if (match) {
                        const val = match[2].trim();
                        if (val.length > 2) {
                            chunkFindings.push({ category: match[1].toUpperCase(), value: val });
                        }
                    }
                }
                return chunkFindings;
            } catch (err) {
                console.error("[GromitParallel] Errore chunk:", err);
                return [];
            }
        }));

        // 3. Merging e De-duplicazione istantanea
        for (const chunkResults of results) {
            for (const f of chunkResults) {
                const key = `${f.value.toLowerCase()}|${f.category}`;
                if (!seenKeys.has(key)) {
                    allFindings.push(f);
                    seenKeys.add(key);
                    knownValues.push(f.value);
                }
            }
        }
    }

    console.log(`[GromitParallel] Completato! Elementi trovati: ${allFindings.length}`);
    sendResponse({ success: true, findings: allFindings });
}
