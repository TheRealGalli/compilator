/**
 * Ollama Client Utility (Local-First)
 * Utilizzato per chiamare direttamente localhost:11434 dal browser per Zero-Data privacy.
 */

export interface PIIFinding {
    value: string;
    category: string;
    label?: string;
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
        console.log(`[OllamaLocal] Using GROMIT BRIDGE for ${url}`);
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
            // console.log(`[OllamaLocal] Prova connessione a ${url}/api/tags...`);

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
                // console.log(`[OllamaLocal] PRONTO! Modello ${OLLAMA_MODEL} trovato su ${url}.`);
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

/**
 * Robust JSON Array Extractor
 * Sometimes models return:
 * ["Name: Mario", "Date: 2024"]
 * or
 * key: value
 * key: value
 */
function normalizeFindings(input: any): any[] {
    if (!input) return [];
    if (Array.isArray(input)) return input;
    if (typeof input === 'object') {
        // Did it return { "findings": [...] } or { "data": [...] }?
        if (Array.isArray(input.findings)) return input.findings;
        if (Array.isArray(input.data)) return input.data;
        if (Array.isArray(input.result)) return input.result;
        // Or just a k-v map? Return entries
        return Object.entries(input).map(([k, v]) => `${k}: ${v}`);
    }
    return [];
}

// Validator Prompt for Strict Mode
// Note: The actual prompt is now generated dynamically inside extractPIILocal


export async function extractPIILocal(text: string): Promise<PIIFinding[]> {
    if (!text || text.trim() === "") return [];

    // console.log(`[OllamaLocal] Starting Hybrid PII Extraction on ${text.length} chars...`);
    // Value -> { type, label }
    const unifiedFindings = new Map<string, { type: string, label?: string }>();

    // 1. REGEX SNIPER (Trusted High Confidence)
    // We run regex first to catch obvious things (IBAN, Email, CF) which are mathematically verifiable.
    const { scanTextCandidates } = await import('./regex-patterns');
    const candidates = scanTextCandidates(text);
    // User requested opening up to MEDIUM and LOW confidence
    const regexCandidates = candidates.filter(c => ['HIGH', 'MEDIUM', 'LOW'].includes(c.confidence));

    // console.log(`[OllamaLocal] Regex found ${regexCandidates.length} items (High/Medium/Low).`);

    // Auto-accept Regex Candidates
    for (const c of regexCandidates) {
        unifiedFindings.set(c.value, { type: c.type, label: c.type });
    }

    // 2. LLM SWEEPER (Full Text Discovery)
    // User requested FULL DOCUMENT context.
    // console.log(`[OllamaLocal] Sending FULL TEXT (${text.length} chars) to LLM...`);
    // console.log("[OllamaLocal] Full Extracted Text Preview:\n", text); // Re-enabled for verification

    // ULTRA-CONCISE PROMPT (User's Proven Prompt)
    // We use the exact phrasing that worked in chat.
    const prompt = `find PERSONAL data in the text and do a token for pseuddonimiz it , return only the list of DATA as a tokenized format.
    
Text:
${text}
`;

    // DEBUG: Removed sensitive prompt log

    try {
        const payload = {
            model: OLLAMA_MODEL,
            messages: [{ role: 'user', content: prompt }],
            stream: false,
            // format: 'json', // REMOVE JSON FORMAT ENFORCEMENT - Let it speak naturally
            options: {
                temperature: 0.1,
                num_ctx: 8192
            }
        };

        const data = await _extractWithRetry(payload, 2);
        let findings: any[] = [];
        let rawResponse = data.message?.content || "";

        // DEBUG: Removed sensitive raw response log

        // Helper to parse a single line "KEY: VALUE"
        const parseLine = (line: string): { value: string, type: string, label: string } | null => {
            // Matches: "NAME: Mario Rossi", "P.IVA: 123", "INIZIO ATTIVITA': 01..."
            // Accepts dots, apostrophes, hyphens, and accented chars in the KEY
            const match = line.match(/^\s*([A-Za-z0-9_ \-\.\'àèìòùÀÈÌÒÙ]+)\s*[:=]\s*(.+)\s*$/);
            if (!match) return null;

            const key = match[1].trim().toUpperCase();
            let val = match[2].trim();

            // Simple hygiene
            if (val.length < 2) return null;
            if (key.includes("EXPLANATION") || key.includes("NOTE")) return null;

            // Map generic keys to our CATEGORIES
            let type = 'UNKNOWN';
            if (key.includes('NAME') || key.includes('NOME') || key.includes('TITOLARE') || key.includes('SOGGETTO') || key.includes('COGNOME') || key.includes('SURNAME')) type = 'NAME';
            else if (key.includes('ADDRESS') || key.includes('INDIRIZZO') || key.includes('RESIDENZA') || key.includes('DOMICILIO') || key.includes('LUOGO') || key.includes('COMUNE') || key.includes('PROV') || key.includes('CITY') || key.includes('LOCATION')) type = 'ADDRESS';
            else if (key.includes('DATE') || key.includes('DATA') || key.includes('INIZIO') || key.includes('FINE')) type = 'DATE';
            else if (key.includes('IVA') || key.includes('VAT') || key.includes('PIVA')) type = 'VAT_NUMBER';
            else if (key.includes('FISCAL') || key.includes('CODE') || key.includes('CF') || key.includes('TAX') || key.includes('CODICE')) type = 'TAX_ID';
            else if (key.includes('MAIL') || key.includes('EMAIL')) type = 'EMAIL_ADDRESS';
            else if (key.includes('PHONE') || key.includes('TEL') || key.includes('CELL')) type = 'PHONE_NUMBER';
            else if (key.includes('ORGANIZATION') || key.includes('COMPANY') || key.includes('DITTA') || key.includes('SOCIETA') || key.includes('BUSINESS') || key.includes('DENOMINAZIONE')) type = 'ORGANIZATION';
            else if (key.includes('IBAN') || key.includes('BANK') || key.includes('CONTO')) type = 'IBAN';
            else type = 'GENERIC_PII';

            // NORMALIZED LABEL
            const normalizedLabel = key.replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
            return { value: val, type, label: normalizedLabel };
        };

        // STRATEGY 1: Try JSON Parse
        const jsonRaw = extractJsonFromResponse(rawResponse);
        const jsonResult = normalizeFindings(jsonRaw);

        // Handle JSON Array of Strings (common output for this prompt)
        if (Array.isArray(jsonResult) && jsonResult.length > 0) {
            console.log("[OllamaLocal] JSON parsed successfully. Processing items...");
            for (const item of jsonResult) {
                if (typeof item === 'string') {
                    // "KEY: Value"
                    const parsed = parseLine(item);
                    if (parsed) findings.push(parsed);
                } else if (typeof item === 'object') {
                    // { "type": "NAME", "value": "Mario" }
                    if (item.value && (item.type || item.category)) {
                        findings.push({
                            value: item.value,
                            type: item.type || item.category || 'UNKNOWN',
                            label: item.label || item.type || item.category || 'UNKNOWN'
                        });
                    }
                }
            }
        }

        // STRATEGY 2: Parse Line-by-Line (Fallback if JSON failed or returned nothing)
        if (findings.length === 0 && rawResponse.includes(':')) {
            console.log("[OllamaLocal] JSON failed or empty. Trying Line-by-Line parsing...");
            const lines = rawResponse.split('\n');
            for (const line of lines) {
                const parsed = parseLine(line);
                if (parsed) findings.push(parsed);
            }
        } if (!Array.isArray(findings)) findings = [];

        if (findings.length === 0) {
            console.warn("[OllamaLocal] LLM returned 0 findings (after parsing).");
        }

        console.log(`[OllamaLocal] LLM parsed ${findings.length} items from response.`);

        // Merge findings
        for (const finding of findings) {
            if (finding.value && finding.value.length > 1) {
                const val = finding.value.trim();

                // CHECK FOR DUPLICATES
                if (unifiedFindings.has(val)) {
                    const existing = unifiedFindings.get(val);
                    // If existing is generic (label == type) and new is specific (label != type), UPGRADE IT
                    if (existing && existing.label === existing.type && finding.label && finding.label !== finding.category) {
                        console.log(`[OllamaLocal] UPGRADING duplicate for label: [${finding.label}]`);
                        unifiedFindings.set(val, { type: finding.type, label: finding.label });
                    }
                    continue;
                }

                // Add to findings directly (Trusting the Model)
                // Use the Captured Label if available, otherwise fallback to Type
                const finalLabel = finding.label || finding.type;
                unifiedFindings.set(val, { type: finding.type, label: finalLabel });
                console.log(`[OllamaLocal] + NEW FINDING (${finding.type}) [Label: ${finalLabel}]`);
            }
        }

    } catch (err) {
        console.error(`[OllamaLocal] Full Text Extraction failed:`, err);
        // On fatal error, ensure we at least keep strict regex findings
    }

    // 3. Convert Map to Array
    const finalResults: PIIFinding[] = [];
    for (const [value, data] of unifiedFindings.entries()) {
        finalResults.push({ value, category: data.type, label: data.label });
    }

    // console.log(`[OllamaLocal] Discovery Complete. Total Unique PII: ${finalResults.length}`);
    return finalResults;
}

/**
 * Esegue l'estrazione con logica di retry per gestire errori 503 (Ollama sovraccarico o in caricamento)
 */
async function _extractWithRetry(payload: any, retries = 3, delay = 2000): Promise<any> {
    console.log(`[OllamaLocal] _extractWithRetry starting... (Model: ${payload.model})`);
    for (let i = 0; i < retries; i++) {
        try {
            console.log(`[OllamaLocal] Attempt ${i + 1}/${retries}: Sending request to ${currentBaseUrl}...`);
            const response = await smartFetch(`${currentBaseUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            console.log(`[OllamaLocal] Attempt ${i + 1} response status: ${response.status}`);

            if (response.status === 503) {
                console.warn(`[OllamaLocal] Ollama occupato (503). Tentativo ${i + 1}/${retries} tra ${delay}ms...`);
                await new Promise(r => setTimeout(r, delay));
                delay *= 2; // Backoff esponenziale
                continue;
            }

            if (!response.ok) {
                throw new Error(`Ollama non raggiungibile (Status: ${response.status})`);
            }

            const json = await response.json();
            console.log(`[OllamaLocal] Response JSON received (Length: ${JSON.stringify(json).length})`);
            return json;
        } catch (err) {
            console.error(`[OllamaLocal] Attempt ${i + 1} failed:`, err);
            if (i === retries - 1) throw err;
            console.warn(`[OllamaLocal] Errore connessione, riprovo... (${i + 1}/${retries})`);
            await new Promise(r => setTimeout(r, delay));
        }
    }
    throw new Error('Retries exhausted');
}
