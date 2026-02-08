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

const CHUNK_SIZE = 1800; // Ottimale per stabilità e velocità su M1 8GB
const CHUNK_OVERLAP = 300;

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
            resolve({ success: false, error: 'TIMEOUT', status: 408 });
        }, 60000); // 60 secondi: l'inferenza locale richiede tempo!

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

export async function extractPIILocal(text: string): Promise<PIIFinding[]> {
    if (!text || text.trim() === "") return [];

    if (text.length <= CHUNK_SIZE) {
        return _extractSingleChunk(text);
    }

    console.log(`[OllamaLocal] Documento lungo (${text.length} caratteri). Uso lo splitting...`);
    const allFindings: PIIFinding[] = [];
    const processedValues = new Set<string>();

    for (let i = 0; i < text.length; i += (CHUNK_SIZE - CHUNK_OVERLAP)) {
        const chunk = text.substring(i, i + CHUNK_SIZE);
        try {
            const findings = await _extractSingleChunk(chunk);
            for (const f of findings) {
                const key = `${f.value.toLowerCase()}|${f.category}`;
                if (!processedValues.has(key)) {
                    allFindings.push(f);
                    processedValues.add(key);
                }
            }
            // Piccolo delay tra i chunk per non saturare la GPU/RAM del Mac M1
            await new Promise(r => setTimeout(r, 1000));
        } catch (err) {
            console.warn(`[OllamaLocal] Errore durante il chunking a offset ${i}, salto...`);
        }
        if (i + CHUNK_SIZE >= text.length) break;
    }

    return allFindings;
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

async function _extractSingleChunk(text: string): Promise<PIIFinding[]> {
    console.log(`[OllamaLocal] Estrazione PII dal chunk (${text.length} caratteri)...`);

    const systemPrompt = `DLP Expert specialized in Italian data (primary target) but also trained for international contexts. Extract ALL possible personal data, names, phones, and form field values as JSON from <INPUT_DATA>.
Rules:
- Capture everything that looks like an input or an identity, regardless of origin.
- Output ONLY JSON: {"findings": [{"value": "...", "category": "..."}]}
- Allowed categories: NOME_PERSONA, ORGANIZZAZIONE, INDIRIZZO, EMAIL, TELEFONO, CODICE_FISCALE, PARTITA_IVA, IBAN, ALTRO.
- Italian Patterns (Primary):
  * NOME_PERSONA: Capture full names (Italian and foreign).
  * CODICE_FISCALE: 16 alphanumeric characters.
  * IBAN: International Bank Account Numbers (all origins, primarily "IT").
  * PARTITA_IVA: 11-digit numeric strings.
  * INDIRIZZO: Addresses (Italian and international formats).
- Be extremely thorough. Better to include too much than too little.
- NO prose. NO repeating input.`;

    try {
        const payload = {
            model: OLLAMA_MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `<INPUT_DATA>\n${text}\n</INPUT_DATA>` }
            ],
            format: 'json',
            stream: false,
            options: {
                temperature: 0.1,
                num_predict: 512, // Sufficient for a list of findings
            }
        };

        const data = await _extractWithRetry(payload);
        if (!data || !data.message) {
            throw new Error("Risposta incompleta da Ollama");
        }
        let rawResponse = data.message.content || "";

        try {
            // Tentativo 1: Parse diretto (spesso funziona se format: 'json' è attivo)
            const parsed = JSON.parse(rawResponse);
            return (parsed.findings || []).filter((f: any) => f.value && f.value.length > 2);
        } catch (e) {
            // Tentativo 2: Pulizia tramite regex (se c'è markdown o testo intorno)
            try {
                const jsonMatch = rawResponse.match(/[\{\[]([\s\S]*)[\}\]]/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    return (Array.isArray(parsed) ? parsed : (parsed.findings || [])).filter((f: any) => f.value && f.value.length > 2);
                }
            } catch (innerE) {
                // Se fallisce anche la pulizia, usiamo il fallback regex ignorando la struttura JSON
                console.debug("[OllamaLocal] JSON parse failed. Raw response for debugging:", rawResponse);
            }

            // Fallback: estrazione grezza tramite regex degli oggetti {"value": "...", "category": "..."}
            const findings: PIIFinding[] = [];
            const entryRegex = /\{\s*"value":\s*"([^"]+)"\s*,\s*"category":\s*"([^"]+)"\s*\}/g;
            let match;
            while ((match = entryRegex.exec(rawResponse)) !== null) {
                if (match[1] && match[1].length > 2) {
                    findings.push({ value: match[1], category: match[2] });
                }
            }

            if (findings.length > 0) {
                console.log(`[OllamaLocal] Struttura JSON malformata, ma estratti ${findings.length} elementi tramite regex.`);
            }
            return findings;
        }
    } catch (error) {
        if (error instanceof Error && error.message.includes('403')) {
            console.error('[OllamaLocal] ERRORE 403 in estrazione. Verifica l\'estensione bridge.');
        } else if (error instanceof Error && error.message.includes('503')) {
            console.error('[OllamaLocal] ERRORE 503: Ollama è sovraccarico o il modello sta crashando.');
            console.info('[OllamaLocal] CONSIGLIO: Tieni l\'app Desktop di Ollama APERTA e visibile.');
        }
        console.error('[OllamaLocal] Errore estrazione:', error);
        throw error;
    }
}
