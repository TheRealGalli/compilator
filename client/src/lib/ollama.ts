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



// Validator Prompt for Gemma 3
const VALIDATOR_PROMPT = `MISSION: PII Validation.
You will receive a list of "Candidates" (text snippets) with their surrounding context and a PROPOSED TYPE.
Your job is to determine if each candidate is GENUINE and if the TYPE is correct.

[RULES]
1. ANALYZE context. 
   - "Nato a [Roma]" -> [Roma] is PLACE_OF_BIRTH (CONFIRM).
   - "Società [Acme Srl]" -> [Acme Srl] is ORGANIZATION (CONFIRM).
   - "Sig. [Mario Rossi]" -> [Mario Rossi] is FULL_NAME (CONFIRM).
2. COMPATIBILITY: If category is ORGANIZATION but value is a person's name (e.g. "Studio Legale [Mario Rossi]"), acceptable as ORGANIZATION or FULL_NAME.
3. IGNORE: Creative works, generic dates ("2023"), public info.
4. RETURN: A JSON array of IDs that are VALID.
   Example Input: [{"id": 1, "value": "Roma", "type": "PLACE_OF_BIRTH", "context": "nato a Roma"}, {"id": 2, "value": "2024", "type": "DATE", "context": "Copyright 2024"}]
   Example Output: [1]
   (Because "Roma" is a valid birthplace, "2024" is copyright year).

[CRITICAL]
- Return ONLY the JSON array of integers. No markdown, no explanation.`;

export async function extractPIILocal(text: string): Promise<PIIFinding[]> {
    if (!text || text.trim() === "") return [];

    // 1. SCAN CANDIDATES (Regex + Heuristics)
    const { scanTextCandidates } = await import('./regex-patterns');
    const candidates = scanTextCandidates(text);

    console.log(`[OllamaLocal] Found ${candidates.length} candidates.`);

    const highConfidence: PIIFinding[] = [];
    const toValidate: any[] = [];

    // 2. SORT CANDIDATES
    // High Confidence -> Auto-accept
    // Low/Medium (Names, Dates, Phones) -> Send to LLM
    let idCounter = 1;
    for (const c of candidates) {
        if (c.confidence === 'HIGH') {
            highConfidence.push({ value: c.value, category: c.type });
        } else {
            // Check for obvious false positive dates (e.g. today's year alone)
            if (c.type === 'DATE' && c.value.length < 6) continue;

            toValidate.push({
                id: idCounter++,
                value: c.value,
                type: c.type,
                context: c.context.replace(/\n/g, ' ').substring(0, 80) // Limit context
            });
        }
    }

    console.log(`[OllamaLocal] Auto-accepted: ${highConfidence.length}. To Validate: ${toValidate.length}.`);

    if (toValidate.length === 0) {
        return highConfidence;
    }

    // 3. VALIDATE WITH GEMMA (Batched)
    const VALIDATION_BATCH_SIZE = 20;
    const validIds = new Set<number>();

    for (let i = 0; i < toValidate.length; i += VALIDATION_BATCH_SIZE) {
        const batch = toValidate.slice(i, i + VALIDATION_BATCH_SIZE);
        console.log(`[OllamaLocal] Validating batch ${i} - ${i + batch.length}...`);

        try {
            const payload = {
                model: OLLAMA_MODEL,
                messages: [
                    { role: 'system', content: VALIDATOR_PROMPT },
                    { role: 'user', content: JSON.stringify(batch) }
                ],
                stream: false,
                options: { temperature: 0.0, num_ctx: 4096 } // Low context needed
            };

            const data = await _extractWithRetry(payload, 2); // Less retries needed
            const raw = data.message?.content || "[]";
            console.log('[DEBUG-RAW] Validator Output:', raw);

            // Extract JSON array from potentially messy output
            const jsonMatch = raw.match(/\[.*\]/s);
            if (jsonMatch) {
                const ids = JSON.parse(jsonMatch[0]);
                if (Array.isArray(ids)) {
                    ids.forEach((id: number) => validIds.add(id));
                }
            }
        } catch (e) {
            console.warn("[OllamaLocal] Validation failed for batch:", e);
        }
    }

    // 4. MERGE RESULTS
    const validatedFindings = toValidate
        .filter(item => validIds.has(item.id))
        .map(item => ({
            value: item.value,
            category: item.type === 'POTENTIAL_NAME' ? 'FULL_NAME' : item.type
        }));

    return [...highConfidence, ...validatedFindings];
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


