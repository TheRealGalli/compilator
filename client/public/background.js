// Gromit Bridge Background Script v3.4.0
// Supports: OLLAMA_FETCH (proxy), OLLAMA_PII_TURBO (full PII extraction), GET_VERSION

const BRIDGE_VERSION = '3.4.0';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    // --- GET_VERSION: Returns bridge version ---
    if (request.type === 'GET_VERSION') {
        sendResponse({ version: BRIDGE_VERSION });
        return true;
    }

    // --- OLLAMA_FETCH: Simple fetch proxy ---
    if (request.type === 'OLLAMA_FETCH') {
        const { url, options } = request;

        console.log('[GromitBridge] Eseguo fetch (Background):', url);

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

    // --- OLLAMA_PII_TURBO: Full PII extraction pipeline ---
    if (request.type === 'OLLAMA_PII_TURBO') {
        const { text, url, model, systemPrompt } = request;

        console.log(`[GromitBridge] TURBO PII: Analyzing ${text.length} chars...`);

        const payload = {
            model: model || 'gpt-oss:20b',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `<INPUT_DATA>\n${text}\n</INPUT_DATA>` }
            ],
            stream: false,
            options: {
                temperature: 0.1,
                num_ctx: 32768,
                num_predict: 4096,
            }
        };

        fetch(`${url}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            mode: 'cors',
            credentials: 'omit',
            referrerPolicy: 'no-referrer'
        })
            .then(async response => {
                if (!response.ok) {
                    throw new Error(`Ollama error: ${response.status}`);
                }
                const data = await response.json();
                const rawResponse = data.message?.content || '';

                // Parse [LABEL] value format
                const findings = [];
                const lines = rawResponse.split('\n');

                for (const line of lines) {
                    const match = line.trim().match(/^\[([A-Z_]+)\]\s*(.*)$/i);
                    if (match) {
                        const category = match[1].toUpperCase();
                        const value = match[2].trim();

                        // Filter out placeholders
                        const isPlaceholder = /\[.*\]|example|not specified|information not|synthetic|NOME_PERSONA_\d+/i.test(value);

                        if (value && value.length > 2 && !isPlaceholder) {
                            findings.push({ value, category });
                        }
                    }
                }

                console.log(`[GromitBridge] TURBO PII: Found ${findings.length} items`);
                sendResponse({ findings });
            })
            .catch(error => {
                console.error('[GromitBridge] TURBO PII Error:', error);
                sendResponse({ findings: [], error: error.message });
            });

        return true;
    }
});
