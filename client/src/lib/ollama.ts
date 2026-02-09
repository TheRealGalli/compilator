/**
 * Ollama Client Utility (Local-First)
 * Utilizzato per chiamare direttamente localhost:11434 dal browser per Zero-Data privacy.
 */

export interface PIIFinding {
    value: string;
    category: string;
}

let currentBaseUrl = 'http://localhost:11434';
const OLLAMA_MODEL = 'gemma3:1b';

const CHUNK_SIZE = 32000; // ~32k chars, safe for Gemma 3 context
const CHUNK_OVERLAP = 2000;

/**
 * Rileva se l'estensione "Gromit Bridge" è caricata tramite flag nel DOM o window prop.
 */
function isBridgeAvailable(): boolean {
    return (
        document.documentElement.getAttribute('data-gromit-bridge-active') === 'true' ||
        (window as any).__GROMIT_BRIDGE_ACTIVE__ === true
    );
}

/**
 * Helper per eseguire fetch tramite l'estensione "Gromit Bridge".
 */
async function fetchViaBridge(url: string, options: any): Promise<any> {
    return new Promise((resolve) => {
        const requestId = Math.random().toString(36).substring(7);
        const timeout = setTimeout(() => {
            window.removeEventListener('GROMIT_BRIDGE_RESPONSE', handler);
            console.warn(`[GromitBridge] TIMEOUT su ${url} dopo 120s`);
            resolve({ success: false, error: 'TIMEOUT', status: 408 });
        }, 120000); // Alzato a 120s per gestire chunk 8k su modelli pesanti

        const handler = (event: any) => {
            if (event.detail.requestId === requestId) {
                clearTimeout(timeout);
                window.removeEventListener('GROMIT_BRIDGE_RESPONSE', handler);
                resolve(event.detail.response);
            }
        };

        window.addEventListener('GROMIT_BRIDGE_RESPONSE', handler);
        window.dispatchEvent(new CustomEvent('GROMIT_BRIDGE_REQUEST', {
            detail: { detail: { type: 'OLLAMA_FETCH', url, options }, requestId }
        }));
    });
}

/**
 * Esegue una fetch intelligente:
 * 1. Se l'estensione è presente, usa SOLO quella (evita CORS errors).
 * 2. Se non c'è, prova fetch diretta (funzionerà solo se OLLAMA_ORIGINS è settato).
 */
async function smartFetch(url: string, options: any = {}): Promise<any> {
    if (isBridgeAvailable()) {
        const bridgeResult = await fetchViaBridge(url, options);
        if (bridgeResult && bridgeResult.success) {
            return {
                ok: bridgeResult.ok,
                status: bridgeResult.status,
                json: async () => bridgeResult.data
            };
        }

        // Se il bridge fallisce, restituiamo l'errore specifico (es. 408 Timeout o 503)
        return {
            ok: false,
            status: bridgeResult?.status || 503,
            json: async () => ({ error: bridgeResult?.error || 'Bridge error' })
        };
    }

    // Solo se l'estensione manca, proviamo la fetch standard
    return fetch(url, options);
}

/**
 * Utility di diagnostica per verificare se Ollama è raggiungibile e ha il modello caricato.
 */
export async function testOllamaConnection(): Promise<boolean> {
    const urls = [
        'http://localhost:11434',
        'http://127.0.0.1:11434'
    ];

    let lastError: any = null;
    let anySuccess = false;

    for (const url of urls) {
        try {
            console.log(`[OllamaLocal] Prova connessione a ${url}/api/tags...`);

            const response = await smartFetch(`${url}/api/tags`, { method: 'GET' });

            if (!response.ok) {
                console.warn(`[OllamaLocal] ${url} risponde, ma con errore ${response.status}`);
                continue;
            }

            const data = await response.json();
            const models = (data.models || []).map((m: any) => m.name.toLowerCase());
            anySuccess = true;

            // Controllo per gemma3:1b
            const hasModel = models.some((name: string) =>
                name === OLLAMA_MODEL ||
                name.startsWith(`${OLLAMA_MODEL}:`) ||
                name === 'gemma3:latest' ||
                (name.includes('gemma3') && name.includes('1b'))
            );

            if (hasModel) {
                console.log(`[OllamaLocal] PRONTO! Modello ${OLLAMA_MODEL} trovato su ${url}.`);
                currentBaseUrl = url;
                return true;
            } else {
                console.warn(`[OllamaLocal] Ollama attivo su ${url}, ma il modello '${OLLAMA_MODEL}' non trovato.`);
                console.info(`[OllamaLocal] SOLUZIONE: Esegui 'ollama pull ${OLLAMA_MODEL}'`);
            }
        } catch (err) {
            lastError = err;
            if (lastError instanceof TypeError && lastError.message.includes('fetch')) {
                console.error('[OllamaLocal] BLOCCO DI SICUREZZA RILEVATO.');
                console.info('[OllamaLocal] Se l\'estensione Gromit Bridge è attiva, prova a ricaricare la pagina.');
            } else if (lastError instanceof Error && lastError.message.includes('403')) {
                console.error('[OllamaLocal] ERRORE 403 (FORBIDDEN).');
                console.info('[OllamaLocal] L\'estensione bridge non sembra riuscire a pulire gli headers. Ricarica l\'estensione.');
            } else {
                console.error('[OllamaLocal] Errore di rete:', lastError);
            }
        }
    }

    return false;
}

/**
 * Recupera la versione della Gromit Bridge con un piccolo retry per evitare race conditions all'avvio.
 */
async function getBridgeVersion(retries = 2): Promise<string> {
    for (let i = 0; i <= retries; i++) {
        if (!isBridgeAvailable()) {
            if (i < retries) await new Promise(r => setTimeout(r, 500));
            continue;
        }

        const version = await new Promise<string>((resolve) => {
            const requestId = Math.random().toString(36).substring(7);
            const timeout = setTimeout(() => {
                window.removeEventListener('GROMIT_BRIDGE_RESPONSE', handler);
                resolve("0.0.0");
            }, 2000);

            const handler = (event: any) => {
                if (event.detail.requestId === requestId) {
                    clearTimeout(timeout);
                    window.removeEventListener('GROMIT_BRIDGE_RESPONSE', handler);
                    resolve(event.detail.response?.version || "1.0.0");
                }
            };

            window.addEventListener('GROMIT_BRIDGE_RESPONSE', handler);
            window.dispatchEvent(new CustomEvent('GROMIT_BRIDGE_REQUEST', {
                detail: { detail: { type: 'GET_VERSION' }, requestId }
            }));
        });

        if (version !== "0.0.0") return version;
    }
    return "0.0.0";
}



// Validator + Discovery Prompt for Gemma 3 (Full Context)
const FULL_CONTEXT_PROMPT = `MISSION: PII Validation & Discovery.
I will provide a TEXT CHUNK and a list of "REGEX CANDIDATES".
Your job is to:
1. VALIDATE candidates: Confirm if they are real persons/orgs in this context. reject verbs/common words.
2. DISCOVER new PII: Find names/orgs/places that Regex missed.

[RULES]
- Context is KING. "Rossi" in "Sig. Rossi" is a Name. "Rossi" in "colore rossi" is an adjective (Reject).
- "Si impegna", "Dichiara", "Sottoscritto" are VERBS/ROLES, not names (Reject).
- "Mario Rossi" (Double Cap) is usually a Name (Confirm).

[OUTPUT FORMAT]
Return a JSON array of objects:
[{"value": "Mario Rossi", "type": "FULL_NAME"}, {"value": "Acme Srl", "type": "ORGANIZATION"}]
- VALUE must be exactly as in text.
- TYPE must be one of: FULL_NAME, ORGANIZATION, PLACE_OF_BIRTH, DATE_OF_BIRTH, UNKNOWN.
- NO Markdown. NO Explanations. ONLY JSON.

[INPUT DATA]
`;

export async function extractPIILocal(text: string): Promise<PIIFinding[]> {
    if (!text || text.trim() === "") return [];

    // 1. SCAN CANDIDATES (Regex + Heuristics + Dictionary)
    const { scanTextCandidates } = await import('./regex-patterns');
    const candidates = scanTextCandidates(text);
    console.log(`[OllamaLocal] Regex/Dict found ${candidates.length} candidates.`);

    const highConfidenceCandidates = candidates.filter(c => c.confidence === 'HIGH');
    const lowConfidenceCandidates = candidates.filter(c => c.confidence !== 'HIGH');

    // 2. PREPARE TEXT CHUNKS (For Full Context Analysis)
    // Even though user wants "Full Context", sending 100k chars to Gemma 1B will fail/hallucinate.
    // We chunk smart (~20k chars) to give enough context for paragraphs.
    const CONTEXT_WINDOW = 20000;
    const chunks = [];
    for (let i = 0; i < text.length; i += CONTEXT_WINDOW) {
        chunks.push(text.substring(i, i + CONTEXT_WINDOW + 1000)); // +1000 for overlap
    }

    console.log(`[OllamaLocal] Splitting document into ${chunks.length} chunks for Full-Context analysis.`);

    const unifiedFindings = new Map<string, string>(); // Value -> Type

    // Pre-populate with HIGH confidence regex (Strict Matches like IBAN, CF are always true)
    // We don't even need to ask Gemma about IBANs, they are math patterns.
    // We only ask Gemma about Names/Orgs/Places.
    for (const c of highConfidenceCandidates) {
        if (!['FULL_NAME', 'ORGANIZATION', 'PLACE_OF_BIRTH'].includes(c.type)) {
            // It's a structured field (Email, CF, etc.) -> Accept immediately
            unifiedFindings.set(c.value, c.type);
        }
    }

    // 3. PROCESS EACH CHUNK
    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];

        // Filter candidates relevant to this chunk (optimization)
        const chunkCandidates = lowConfidenceCandidates.filter(c => chunk.includes(c.value));
        const candidateListStr = JSON.stringify(chunkCandidates.map(c => ({ value: c.value, type: c.type })));

        console.log(`[OllamaLocal] Analyzing Chunk ${i + 1}/${chunks.length} with ${chunkCandidates.length} hints...`);

        try {
            const prompt = `${FULL_CONTEXT_PROMPT}\n\n[REGEX CANDIDATES]\n${candidateListStr}\n\n[TEXT CHUNK]\n${chunk}`;

            const payload = {
                model: OLLAMA_MODEL,
                messages: [{ role: 'user', content: prompt }],
                stream: false,
                options: {
                    temperature: 0.1, // Low temp for precision
                    num_ctx: 32000    // High context window for Input processing
                }
            };

            const data = await _extractWithRetry(payload, 2);
            const raw = data.message?.content || "[]";

            // Safe JSON Parse
            const jsonMatch = raw.match(/\[.*\]/s);
            if (jsonMatch) {
                const results = JSON.parse(jsonMatch[0]);
                if (Array.isArray(results)) {
                    results.forEach((item: any) => {
                        if (item && item.value && item.value.length > 2) {
                            // "Gemma, did you find 'Si impegna'?" -> "No"
                            // Only valid items survive here.
                            unifiedFindings.set(item.value, item.type);
                        }
                    });
                }
            }
        } catch (e) {
            console.warn(`[OllamaLocal] Chunk ${i} analysis failed:`, e);
            // Fallback: If Gemma fails, we at least keep High Confidence regex
        }
    }

    // Convert Map to Array
    const finalResults: PIIFinding[] = [];
    for (const [value, category] of unifiedFindings.entries()) {
        finalResults.push({ value, category });
    }

    console.log(`[OllamaLocal] Total Unique Findings: ${finalResults.length}`);
    return finalResults;
}

/**
 * Esegue l'estrazione con logica di retry per gestire errori 503 (Ollama sovraccarico o in caricamento)
 */
async function _extractWithRetry(payload: any, retries = 3, delay = 2000): Promise<any> {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await smartFetch(`${currentBaseUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.status === 503) {
                console.warn(`[OllamaLocal] Ollama occupato (503). Tentativo ${i + 1}/${retries} tra ${delay}ms...`);
                await new Promise(r => setTimeout(r, delay));
                delay *= 2; // Backoff esponenziale
                continue;
            }

            if (!response.ok) {
                throw new Error(`Ollama non raggiungibile (Status: ${response.status})`);
            }

            return await response.json();
        } catch (err) {
            if (i === retries - 1) throw err;
            console.warn(`[OllamaLocal] Errore connessione, riprovo... (${i + 1}/${retries})`);
            await new Promise(r => setTimeout(r, delay));
        }
    }
    throw new Error('Retries exhausted');
}


