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

const CHUNK_SIZE = 8000; // Large context for full-document mapping
const CHUNK_OVERLAP = 1000;

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
        if (i < retries) await new Promise(r => setTimeout(r, 500));
    }
    return "0.0.0";
}

// Prompt unificato per massima precisione (Surgical Precision 5.0)
const SHARED_MISSION_PROMPT = `MISSION: High-Fidelity Identity Discovery (Surgical Precision 5.0)

OBJECTIVE: Extract ONLY legitimate, human-entered identity data.
ZERO TOLERANCE for system boilerplate, legal labels, or generic placeholders.

JUDGMENT RULES:
1. VALUE VS LABEL: A value is NOT real if it's identical or derivative of the field label (e.g., "Taxpayer Name: Taxpayer Name").
2. SEMANTIC FILTRATION: Discard all generic placeholders and system-generated text:
   * Status: N/A, None, Not Applicable, Unknown, Pending, Not Provided, Da compilare, Inserire qui.
   * Examples: Example, yourname@example.com, john.doe, Mario Rossi (as a generic placeholder), Esempio, Sig./Sig.ra.
   * Links: URLs starting with .gov, .edu, .org, example.com, or similar generic domains (e.g., irs.gov, agenziaentrate.it).
   * Instructions/Boilerplate: Any text that instructs the user to fill in information, refers to legal sections, or describes the field rather than providing data.
3. IDENTITY VALIDATION:
   * NOME_PERSONA: Must contain 2+ words (first name and last name), no generic terms like "Officer," "Taxpayer," "Azienda," "Company," or "Ditta."
   * COGNOME_PERSONA: Must contain at least one word, no generic terms.
   * DATA_DI_NASCITA: Must be a valid date format (e.g., DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, DD-MMM-YYYY).
   * LUOGO_DI_NASCITA: Must be a recognizable city, town, or country name.
   * CODICE_FISCALE: Must be a 16-character alphanumeric string (Italian pattern).
   * PARTITA_IVA: Must be an 11-digit numeric string (Italian pattern).
   * INDIRIZZO_COMPLETO: Must contain street name and number, city, and postal code.
   * CAP: Must be a 5-digit numeric string for Italian postal codes.
   * NUMERO_TELEFONO: Must contain at least 7 digits.
   * EMAIL: Must contain "@" and a valid domain.
   * IBAN: Valid structure for an IBAN (e.g., starting with "IT").
   * ORGANIZZAZIONE: Ignore generic business type labels (e.g., "Limited Liability Company," "S.r.l."). Focus on actual business name.

PERSONAL DATA LABELS:
[NOME_PERSONA], [COGNOME_PERSONA], [DATA_DI_NASCITA], [LUOGO_DI_NASCITA], [CODICE_FISCALE], [PARTITA_IVA], [INDIRIZZO_COMPLETO], [VIA], [CITTA], [PROVINCIA], [CAP], [NAZIONE], [NUMERO_TELEFONO], [EMAIL], [NUMERO_DOCUMENTO], [TIPO_DOCUMENTO], [DATA_EMISSIONE_DOCUMENTO], [DATA_SCADENZA_DOCUMENTO], [ENTE_EMITTENTE_DOCUMENTO], [SESSO], [NAZIONALITA], [PROFESSIONE], [IBAN], [ORGANIZZAZIONE], [RUOLO]

RESPONSE FORMAT:
One finding per line in format: [LABEL] Value
No JSON. No prose.

CONTRASTIVE LEARNING:

[CASE A: Boilerplate Noise]
Input: "...Taxpayer Identification Number (TIN). See instructions for Part I. Number: Unknown. Nome del Cliente: Inserire qui."
Output: (NOTHING)

[CASE B: Example Data]
Input: "...Enter your email here (e.g., mario.rossi@example.com). Nome Cognome: John Doe. Indirizzo: Via Roma 1 (solo per test)..."
Output: (NOTHING)

[CASE C: Real Data Discovery]
Input: "...Dati Anagrafici: Nome: Marco, Cognome: Bianchi, Data di Nascita: 15/03/1985, Luogo di Nascita: Roma, Italia, CF: BNCMCR85C15H501V, Indirizzo: Via Garibaldi 12, 20121 Milano (MI), Azienda: Tech Solutions S.r.l., P.IVA: 09876543210..."
Output:
[NOME_PERSONA] Marco Bianchi
[COGNOME_PERSONA] Bianchi
[DATA_DI_NASCITA] 15/03/1985
[LUOGO_DI_NASCITA] Roma
[NAZIONE] Italia
[CODICE_FISCALE] BNCMCR85C15H501V
[INDIRIZZO_COMPLETO] Via Garibaldi 12, 20121 Milano (MI), Italia
[VIA] Via Garibaldi 12
[CITTA] Milano
[PROVINCIA] MI
[CAP] 20121
[ORGANIZZAZIONE] Tech Solutions
[PARTITA_IVA] 09876543210

[CASE D: Mixed Data & Global Context]
Input: "...Application for Mr. David Miller (1980-07-22), Place of Birth: London, UK, Address: 10 Downing Street, London SW1A 2AA, UK. Phone: +44 20 7946 0123."
Output:
[NOME_PERSONA] David Miller
[DATA_DI_NASCITA] 1980-07-22
[LUOGO_DI_NASCITA] London
[NAZIONE] UK
[INDIRIZZO_COMPLETO] 10 Downing Street, London SW1A 2AA, United Kingdom
[VIA] 10 Downing Street
[CITTA] London
[CAP] SW1A 2AA
[NUMERO_TELEFONO] +44 20 7946 0123`;

export async function extractPIILocal(text: string): Promise<PIIFinding[]> {
    if (!text || text.trim() === "") return [];

    const version = await getBridgeVersion();
    const isTurboAvailable = version.startsWith("3.");

    if (isTurboAvailable) {
        console.log(`[OllamaLocal] Bridge v${version} rilevata. Uso TURBO PIPELINE (Offload)...`);
        return new Promise((resolve) => {
            const requestId = Math.random().toString(36).substring(7);
            const handler = (event: any) => {
                if (event.detail.requestId === requestId) {
                    window.removeEventListener('GROMIT_BRIDGE_RESPONSE', handler);
                    const findings = event.detail.response?.findings || [];
                    console.log(`[OllamaLocal] Turbo Pipeline completata: ${findings.length} elementi trovati.`);
                    resolve(findings);
                }
            };
            window.addEventListener('GROMIT_BRIDGE_RESPONSE', handler);

            window.dispatchEvent(new CustomEvent('GROMIT_BRIDGE_REQUEST', {
                detail: {
                    detail: {
                        type: 'OLLAMA_PII_TURBO',
                        text,
                        url: currentBaseUrl,
                        model: OLLAMA_MODEL,
                        systemPrompt: SHARED_MISSION_PROMPT
                    },
                    requestId
                }
            }));
        });
    }

    console.warn(`[OllamaLocal] Bridge v${version} non supporta Turbo. Fallback su splitting manuale.`);

    // Fallback classico se il bridge è vecchio o assente
    if (text.length <= CHUNK_SIZE) {
        return _extractSingleChunk(text, []);
    }

    console.log(`[OllamaLocal] Documento lungo (${text.length} caratteri). Uso splitting PARALLELO (Context: ${CHUNK_SIZE})...`);
    const allFindings: PIIFinding[] = [];
    const processedValues = new Set<string>();

    // Creazione dei chunk
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += (CHUNK_SIZE - CHUNK_OVERLAP)) {
        chunks.push(text.substring(i, i + CHUNK_SIZE));
        if (i + CHUNK_SIZE >= text.length) break;
    }

    // Esecuzione parallela a lotti (max 2 alla volta per stabilità con chunk da 8k)
    const BATCH_SIZE = 2;
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const currentBatch = chunks.slice(i, i + BATCH_SIZE);
        const knownList = Array.from(processedValues).slice(-150);

        console.log(`[OllamaLocal] Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)}...`);

        const batchResults = await Promise.all(
            currentBatch.map(chunk => _extractSingleChunk(chunk, knownList).catch(err => {
                console.warn("[OllamaLocal] Errore in un chunk parallelo, salto...", err);
                return [] as PIIFinding[];
            }))
        );

        // Unione risultati ed eliminazione duplicati
        for (const findings of batchResults) {
            for (const f of findings) {
                const valLower = f.value.toLowerCase();
                const key = `${valLower}|${f.category}`;
                if (!processedValues.has(key)) {
                    allFindings.push(f);
                    processedValues.add(key);
                }
            }
        }
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

async function _extractSingleChunk(text: string, knownValues: string[]): Promise<PIIFinding[]> {
    const knownContext = knownValues.length > 0
        ? `\n\nALREADY IDENTIFIED DATA (DO NOT LIST THESE AGAIN):\n- ${knownValues.join('\n- ')}`
        : "";

    try {
        const payload = {
            model: OLLAMA_MODEL,
            messages: [
                { role: 'system', content: SHARED_MISSION_PROMPT + knownContext },
                { role: 'user', content: `<INPUT_DATA>\n${text}\n</INPUT_DATA>` }
            ],
            stream: false,
            options: {
                temperature: 0.1,
                num_ctx: 16384,
                num_predict: 2048,
            }
        };

        const data = await _extractWithRetry(payload);
        if (!data || !data.message) {
            throw new Error("Risposta incompleta da Ollama");
        }
        let rawResponse = data.message.content || "";

        const findings: PIIFinding[] = [];
        const lines = rawResponse.split('\n');

        for (const line of lines) {
            const match = line.trim().match(/^\[([A-Z_]+)\]\s*(.*)$/i);
            if (match) {
                const category = match[1].toUpperCase();
                const value = match[2].trim();

                // Final safety check against obvious synthetic placeholders
                const isPlaceholder = /\[.*\]|example|not specified|information not|synthetic|NOME_PERSONA_\d+/i.test(value);

                if (value && value.length > 2 && !isPlaceholder) {
                    findings.push({ value, category });
                }
            }
        }

        if (findings.length > 0) {
            console.log(`[OllamaLocal] Estratti ${findings.length} elementi (Text Mode).`);
        }

        return findings;
    } catch (error) {
        console.error('[OllamaLocal] Errore estrazione:', error);
        throw error;
    }
}
