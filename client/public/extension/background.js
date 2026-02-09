// Gromit Bridge Background Script v3.5.0
// Supports: OLLAMA_FETCH, OLLAMA_PII_TURBO (with smart chunking), GET_VERSION

const BRIDGE_VERSION = '3.5.0';

// 64k token context ≈ 150k chars (leaving room for prompt/response)
const MAX_CHUNK_CHARS = 150000;
const PARALLEL_SLOTS = 4;

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

    // --- OLLAMA_PII_TURBO: Full PII extraction with smart chunking ---
    if (request.type === 'OLLAMA_PII_TURBO') {
        const { text, url, model, systemPrompt } = request;

        console.log(`[GromitBridge] TURBO PII v3.5: Analyzing ${text.length} chars...`);

        // Smart chunking: split if exceeds limit
        const chunks = [];
        if (text.length <= MAX_CHUNK_CHARS) {
            chunks.push(text);
        } else {
            // Split into chunks with overlap
            const OVERLAP = 2000;
            for (let i = 0; i < text.length; i += (MAX_CHUNK_CHARS - OVERLAP)) {
                chunks.push(text.substring(i, i + MAX_CHUNK_CHARS));
                if (i + MAX_CHUNK_CHARS >= text.length) break;
            }
            console.log(`[GromitBridge] Document split into ${chunks.length} chunks (${MAX_CHUNK_CHARS} chars each)`);
        }

        // Process chunks in parallel (max PARALLEL_SLOTS at a time)
        const processChunk = async (chunk, chunkIndex) => {
            const payload = {
                model: model || 'gemma3:1b',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `<INPUT_DATA>\n${chunk}\n</INPUT_DATA>` }
                ],
                stream: false,
                options: {
                    temperature: 0.1,
                    num_ctx: 65536,  // 64k token context
                    num_predict: 4096,
                }
            };

            try {
                const response = await fetch(`${url}/api/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    mode: 'cors',
                    credentials: 'omit',
                    referrerPolicy: 'no-referrer'
                });

                if (!response.ok) {
                    throw new Error(`Ollama error: ${response.status}`);
                }

                const data = await response.json();
                const rawResponse = data.message?.content || '';

                console.log(`[GromitBridge] Chunk ${chunkIndex + 1}/${chunks.length} response (first 300 chars):`, rawResponse.substring(0, 300));

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

                console.log(`[GromitBridge] Chunk ${chunkIndex + 1}: Found ${findings.length} items`);
                return findings;
            } catch (error) {
                console.error(`[GromitBridge] Chunk ${chunkIndex + 1} Error:`, error);
                return [];
            }
        };

        // Process in batches of PARALLEL_SLOTS
        (async () => {
            const allFindings = [];
            const seenValues = new Set();

            for (let i = 0; i < chunks.length; i += PARALLEL_SLOTS) {
                const batch = chunks.slice(i, i + PARALLEL_SLOTS);
                console.log(`[GromitBridge] Processing batch ${Math.floor(i / PARALLEL_SLOTS) + 1}/${Math.ceil(chunks.length / PARALLEL_SLOTS)} (${batch.length} chunks in parallel)`);

                const batchResults = await Promise.all(
                    batch.map((chunk, idx) => processChunk(chunk, i + idx))
                );

                // Deduplicate findings
                for (const findings of batchResults) {
                    for (const f of findings) {
                        const key = `${f.value.toLowerCase()}|${f.category}`;
                        if (!seenValues.has(key)) {
                            allFindings.push(f);
                            seenValues.add(key);
                        }
                    }
                }
            }

            console.log(`[GromitBridge] TURBO PII Complete: Found ${allFindings.length} unique items`);
            sendResponse({ findings: allFindings });
        })();

        return true;
    }
});
