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

// Removed CHUNK_SIZE as we are now doing Full Text
// const CHUNK_SIZE = 32000;
// const CHUNK_OVERLAP = 2000;

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

/**
 * Helper to extract JSON from a potentially messy LLM response.
 * Handles markdown blocks, pre-text, post-text, and raw JSON.
 */
function extractJsonFromResponse(text: string): any[] {
    try {
        // 1. Try direct parse
        return JSON.parse(text);
    } catch (e) {
        // 2. Try extracting from markdown code blocks ```json ... ```
        const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch && jsonMatch[1]) {
            try {
                return JSON.parse(jsonMatch[1]);
            } catch (e2) {
                console.warn("[OllamaLocal] JSON in markdown block failed parse:", e2);
            }
        }

        // 3. Try finding the first '[' and last ']'
        const start = text.indexOf('[');
        const end = text.lastIndexOf(']');
        if (start !== -1 && end !== -1 && end > start) {
            try {
                return JSON.parse(text.substring(start, end + 1));
            } catch (e3) {
                console.warn("[OllamaLocal] JSON bracket extraction failed parse:", e3);
            }
        }

        return [];
    }
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
    // User requested FULL DOCUMENT context.
    console.log(`[OllamaLocal] Sending FULL TEXT (${text.length} chars) to LLM...`);

    // Prepare "Known Findings" string (Context only, to avoid re-extracting)
    const knownValues = highConfidenceCandidates.map(c => c.value).join(", ");

    // ULTRA-CONCISE PROMPT (Designed for Gemma 3 1B)
    const prompt = `Analyze the text below. Extract Personal Data (PII) into a JSON array.
CRITICAL: EXTRACT ONLY PERSONAL DATA EXACTLY AS FOUND IN TEXT (Keep ALL spaces and uppercase letters).

Focus on:
1. ADDRESSES (Via, Piazza, Residenza)
2. NAMES (Mario Rossi)
3. DATES

Context (Already found, ignore these specific values but look around them): [${knownValues}]

Output format: [{"value": "...", "type": "CATEGORY"}]

Text:
${text}
`;

    // DEBUG: Log the exact prompt to see what the LLM sees
    console.log("[OllamaLocal] PROMPT DEBUG:\n", prompt);

    try {
        const payload = {
            model: OLLAMA_MODEL,
            messages: [{ role: 'user', content: prompt }],
            stream: false,
            format: 'json',
            options: {
                temperature: 0.1,
                num_ctx: 8192
            }
        };

        const data = await _extractWithRetry(payload, 2);
        let findings: any[] = [];

        if (data.message?.content) {
            console.log("[OllamaLocal] RAW LLM RESPONSE:", data.message.content.substring(0, 500) + "..."); // Valid Log
            findings = extractJsonFromResponse(data.message.content);
        } else {
            console.warn("[OllamaLocal] Empty response content from LLM");
        }

        // AUTO-CORRECT: If findings is a single object { value: ... }, wrap it in an array.
        if (findings && !Array.isArray(findings) && typeof findings === 'object') {
            // @ts-ignore
            if (findings.value) {
                findings = [findings];
                console.log("[OllamaLocal] Single object response wrapped in array.");
            }
        }

        if (!Array.isArray(findings)) findings = [];

        if (findings.length === 0) {
            console.warn("[OllamaLocal] LLM returned 0 findings. Falling back to Medium Confidence Regex.");
            const mediumCandidates = candidates.filter(c => c.confidence === 'MEDIUM');
            for (const c of mediumCandidates) {
                unifiedFindings.set(c.value, c.type);
            }
        }

        console.log(`[OllamaLocal] LLM found ${findings.length} potential items.`);

        // Merge findings
        for (const finding of findings) {
            if (finding.value && finding.value.length > 2) {
                const val = finding.value.trim();

                // Skip if we already found it via Regex (Triple check)
                if (unifiedFindings.has(val)) continue;

                // Add to findings directly (Trusting the Model)
                unifiedFindings.set(val, finding.type);
                console.log(`[OllamaLocal] + NEW FINDING: ${val} (${finding.type})`);
            }
        }

    } catch (err) {
        console.error(`[OllamaLocal] Full Text Extraction failed:`, err);
        // On fatal error, ensure we at least keep strict regex findings
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
