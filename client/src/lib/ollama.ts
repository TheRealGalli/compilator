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



// Validator Prompt for Strict Mode
// Note: The actual prompt is now generated dynamically inside extractPIILocal


export async function extractPIILocal(text: string): Promise<PIIFinding[]> {
    if (!text || text.trim() === "") return [];

    console.log(`[OllamaLocal] Starting Hybrid PII Extraction on ${text.length} chars...`);
    const unifiedFindings = new Map<string, string>(); // Value -> Type

    // 1. REGEX SNIPER (Trusted High Confidence)
    // We run regex first to catch obvious things (IBAN, Email, CF) which are mathematically verifiable.
    const { scanTextCandidates } = await import('./regex-patterns');
    const candidates = scanTextCandidates(text);
    const highConfidenceCandidates = candidates.filter(c => c.confidence === 'HIGH');

    console.log(`[OllamaLocal] Regex found ${highConfidenceCandidates.length} HIGH confidence items.`);

    // Auto-accept High Confidence (IBAN, CF, Dictionary Names)
    for (const c of highConfidenceCandidates) {
        unifiedFindings.set(c.value, c.type);
    }

    // 2. LLM SWEEPER (Full Text Discovery)
    // We split text into semantic chunks (~2500 chars) to allow the LLM to see full context.
    const CHUNK_SIZE = 2500;
    const OVERLAP = 200;
    const chunks: string[] = [];

    for (let i = 0; i < text.length; i += (CHUNK_SIZE - OVERLAP)) {
        chunks.push(text.substring(i, i + CHUNK_SIZE));
    }

    console.log(`[OllamaLocal] Text split into ${chunks.length} chunks for LLM discovery.`);

    // Process chunks sequentially
    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];

        const prompt = `MISSION: FULL PII DISCOVERY.
I will act as a Privacy Officer. I need you to extract EVERY single piece of Personal Data (PII) from the text below.
Do not ask "is this PII?". Instead, FIND IT.

[TARGET ENTITIES]
- NAMES (Employee, Client, Third Party Designee, Responsible Party, Directors)
- ADDRESSES (Full Street, City, State, ZIP)
- ORGANIZATION NAMES (LLC, Inc, Corp, Business Names)
- DATES (Birth, Start Date, Signature Date)
- CODES (SSN, EIN, ITIN - even if partial or "FOREIGN")
- EMAILS & PHONES

[OUTPUT FORMAT]
Return a JSON ARRAY only.
[{"value": "Mario Rossi", "type": "FULL_NAME"}, {"value": "Via Roma 10", "type": "ADDRESS"}]
- "value": Exact substring from text.
- "type": One of FULL_NAME, ORGANIZATION, ADDRESS, DATE, OTHER.

[TEXT TO ANALYZE]
${chunk}
`;

        try {
            // Using internal helper if available or direct fetch
            const payload = {
                model: OLLAMA_MODEL,
                messages: [{ role: 'user', content: prompt }],
                stream: false,
                format: 'json',
                options: {
                    temperature: 0.1, // Low temp for precision
                    num_ctx: 4096     // Ensure large context
                }
            };

            // Assuming _extractWithRetry is available in scope (it is in the file)
            const data = await _extractWithRetry(payload, 2);
            let findings: any[] = [];

            try {
                if (data.message?.content) {
                    findings = JSON.parse(data.message.content);
                }
                if (!Array.isArray(findings)) findings = [];
            } catch (e) {
                console.warn("[OllamaLocal] Failed to parse JSON response:", data.message?.content);
            }

            // Merge findings
            for (const finding of findings) {
                if (finding.value && finding.value.length > 2) {
                    const val = finding.value.trim();
                    // Upsert: LLM context is usually better for 'Type' than Regex Low Confidence.
                    if (!unifiedFindings.has(val)) {
                        unifiedFindings.set(val, finding.type);
                    }
                }
            }

        } catch (err) {
            console.error(`[OllamaLocal] Chunk ${i + 1} failed:`, err);
        }
    }

    // 3. Convert Map to Array
    const finalResults: PIIFinding[] = [];
    for (const [value, category] of unifiedFindings.entries()) {
        finalResults.push({ value, category });
    }

    console.log(`[OllamaLocal] Discovery Complete. Total Unique PII: ${finalResults.length}`);
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


