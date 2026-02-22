/**
 * Ollama Client Utility (Local-First)
 * Utilizzato per chiamare direttamente localhost:11434 dal browser per Zero-Data privacy.
 */

export interface PIIFinding {
    value: string;
    category: string;
    label?: string;
}

import { PII_SCHEMA_DEFINITIONS } from './pii-schema';

let currentBaseUrl = 'http://localhost:11434';
export const DEFAULT_OLLAMA_MODEL = 'gemma3:1b';

/**
 * Filtra valori che non sono vero PII ma rumore tecnico o semantico.
 */
export function isNoisyPII(value: string): boolean {
    if (!value) return true;
    const v = value.trim().toLowerCase();

    // 1. Technical/Schema noise
    const technicalNoise = [
        'cast', 'schema', 'undefined', 'null', 'n/a', 'none', 'no data', 'no info',
        'unknown', 'generic', 'pii', 'token', 'value', 'type', 'id', 'uuid',
        'hidden', 'error', 'failed', 'empty', 'missing', 'not provided', 'provided',
        'not mentioned', 'not specified', 'non specificato', 'not explicitly stated', 'not available',
        '(none)', '(not provided)', '(n/a)'
    ];

    // Clean value from non-alphanumeric chars for comparison
    const cleanV = v.replace(/[^a-z0-9 ]/g, '').trim();
    if (technicalNoise.some(noise => cleanV === noise || cleanV.startsWith(noise + ':'))) return true;

    // 2. Fragment IDs or hex strings (e.g. "cast-281923")
    if (/^[a-zA-Z]+-[0-9]+$/.test(v)) return true; // match "prefix-number"
    if (/^[0-9a-f]{8,}$/i.test(v)) return true;    // long hex strings

    // 3. Time/Hour Filtering (hallucinations like "8:00 AM", "11:30 PM")
    // Values that look like time ranges or specific hours are often false positives
    if (/^(?:\d{1,2}:\d{2}(?:\s?[AP]M)?)|(?:\d{1,2}\s?[AP]M)$/i.test(v)) return true;

    // 4. Short garbage
    if (v.length < 2) return true;

    // 4. Common descriptive text (if LLM hallucinates descriptions as values)
    if (v.split(' ').length > 10) return true; // Way too long to be a standard PII value

    return false;
}

export const AVAILABLE_MODELS = {
    local: [
        { id: 'gemma3:1b', label: 'Gemma 3 (1B)', size: '1.5GB' },
        { id: 'gemma3:4b', label: 'Gemma 3 (4B)', size: '3.0GB' },
        { id: 'gemma3:12b', label: 'Gemma 3 (12B)', size: '8.0GB' },
        { id: 'gemma3:27b', label: 'Gemma 3 (27B)', size: '18GB' },
        { id: 'gpt-oss:20b', label: 'GPT-OSS (20B)', size: '14GB' },
        { id: 'gpt-oss:120b', label: 'GPT-OSS (120B)', size: '75GB' },
    ],
    cloud: [
        { id: 'gpt-oss:20b-cloud', label: 'GPT-OSS (20B)', provider: 'Cloud' },
        { id: 'gpt-oss:120b-cloud', label: 'GPT-OSS (120B)', provider: 'Cloud' },
    ]
};

// Removed CHUNK_SIZE as we are now doing Full Text
// const CHUNK_SIZE = 32000;
// const CHUNK_OVERLAP = 2000;

/**
 * Rileva se l'estensione "Gromit Bridge" è caricata tramite flag nel DOM o window prop.
 * Now checks multiple indicators for robustness (Consistency with local-extractor).
 */
function isBridgeAvailable(): boolean {
    if (typeof window === 'undefined') return false;
    return (
        document.documentElement.getAttribute('data-gromit-bridge-active') === 'true' ||
        (window as any).__GROMIT_BRIDGE_ACTIVE__ === true
    );
}

/**
 * Helper per eseguire fetch tramite l'estensione "Gromit Bridge".
 */
async function fetchViaBridge(url: string, options: any): Promise<any> {
    return new Promise((resolve, reject) => {
        const requestId = Math.random().toString(36).substring(7);
        const signal = options.signal;

        const cleanup = () => {
            clearTimeout(timeout);
            window.removeEventListener('GROMIT_BRIDGE_RESPONSE', handler);
            if (signal) {
                signal.removeEventListener('abort', abortHandler);
            }
        };

        const timeout = setTimeout(() => {
            cleanup();
            console.warn(`[GromitBridge] TIMEOUT su ${url} dopo 120s`);
            resolve({ success: false, error: 'TIMEOUT (Estensione non risponde)', status: 408 });
        }, 120000);

        const handler = (event: any) => {
            if (event.detail.requestId === requestId) {
                cleanup();
                resolve(event.detail.response);
            }
        };

        const abortHandler = () => {
            cleanup();
            // Send a cancellation message to the bridge if supported
            window.dispatchEvent(new CustomEvent('GROMIT_BRIDGE_REQUEST', {
                detail: { detail: { type: 'CANCEL_FETCH', requestId }, requestId }
            }));
            const error = new Error('The user aborted a request.');
            error.name = 'AbortError';
            reject(error);
        };

        if (signal) {
            if (signal.aborted) {
                return abortHandler();
            }
            signal.addEventListener('abort', abortHandler);
        }

        window.addEventListener('GROMIT_BRIDGE_RESPONSE', handler);
        window.dispatchEvent(new CustomEvent('GROMIT_BRIDGE_REQUEST', {
            detail: { detail: { type: 'OLLAMA_FETCH', url, options: { ...options, signal: undefined } }, requestId }
        }));
    });
}

/**
 * Esegue una fetch intelligente:
 * 1. Se l'estensione è presente, usa SOLO quella (evita CORS errors).
 * 2. Se non c'è, prova fetch diretta (funzionerà solo se OLLAMA_ORIGINS è settato).
 */
async function smartFetch(url: string, options: any = {}): Promise<any> {
    // 1. Robust Bridge Check with Retry
    let bridgeActive = isBridgeAvailable();
    if (!bridgeActive) {
        // Retry once mainly for init race conditions
        await new Promise(r => setTimeout(r, 500));
        bridgeActive = isBridgeAvailable();
    }

    if (bridgeActive) {
        console.debug(`[OllamaLocal] Using GROMIT BRIDGE for ${url}`);
        const bridgeResult = await fetchViaBridge(url, options);
        if (bridgeResult && bridgeResult.success) {
            return {
                ok: true,
                status: bridgeResult.status || 200,
                json: async () => {
                    const rawData = bridgeResult.data;
                    let data = {};
                    if (typeof rawData === 'object' && rawData !== null) {
                        data = rawData;
                    } else {
                        try {
                            data = rawData ? JSON.parse(rawData) : {};
                        } catch (e) {
                            console.warn("[OllamaLocal] JSON failed or empty. Trying Line-by-Line parsing...");
                            data = { raw: rawData };
                        }
                    }
                    return data;
                }
            };
        } else {
            const status = bridgeResult?.status ?? 503;
            const errorMsg = bridgeResult?.error || 'Bridge connection failed';

            // Log specifically if it's a network error
            console.warn(`[OllamaLocal 5.8.10] Bridge Error for ${url}: ${errorMsg} (Status: ${status})`);

            if (status === 0 || errorMsg.includes('Failed to fetch') || errorMsg.includes('Extension context invalidated')) {
                console.info(`[OllamaLocal] 💡 Suggerimento: Verifica che Ollama sia attivo (ollama list) e che l'URL sia corretto.`);
                console.info(`[OllamaLocal] 💡 Se hai appena aggiornato l'estensione, RICARICA LA PAGINA (F5) per ristabilire il contatto.`);
            }

            return {
                ok: false,
                status: status,
                json: async () => ({ error: errorMsg })
            };
        }
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
                name === DEFAULT_OLLAMA_MODEL ||
                name.startsWith(`${DEFAULT_OLLAMA_MODEL}:`) ||
                name === 'gemma3:latest' ||
                (name.includes('gemma3') && name.includes('1b'))
            );

            if (hasModel) {
                // console.log(`[OllamaLocal] PRONTO! Modello ${DEFAULT_OLLAMA_MODEL} trovato su ${url}.`);
                currentBaseUrl = url;
                return true;
            } else {
                console.warn(`[OllamaLocal] Ollama attivo su ${url}, ma il modello '${DEFAULT_OLLAMA_MODEL}' non trovato.`);
                console.info(`[OllamaLocal] SOLUZIONE: Esegui 'ollama pull ${DEFAULT_OLLAMA_MODEL}'`);
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
 * Recupera la lista dei modelli installati localmente su Ollama.
 */
export async function getRunningModels(): Promise<string[]> {
    const urls = [
        'http://localhost:11434',
        'http://127.0.0.1:11434'
    ];

    for (const url of urls) {
        try {
            const response = await smartFetch(`${url}/api/tags`, { method: 'GET' });
            if (response.ok) {
                const data = await response.json();
                currentBaseUrl = url; // Update base url if successful
                return (data.models || []).map((m: any) => m.name);
            }
        } catch (e) {
            // ignore
        }
    }
    return [];
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
/**
 * Helper to extract JSON from a potentially messy LLM response.
 * Handles markdown blocks, pre-text, post-text, and concatenated JSON arrays.
 */
function extractJsonFromResponse(text: string): any[] {
    const results: any[] = [];

    const tryParse = (str: string) => {
        try {
            const parsed = JSON.parse(str);
            if (Array.isArray(parsed)) results.push(...parsed);
            else if (typeof parsed === 'object' && parsed !== null) results.push(parsed);
        } catch (e) {
            // If strict parse fails, try to see if it's multiple objects/arrays
            // Or if it's a "messy" JSON
        }
    };

    try {
        // 1. Try direct parse
        const direct = JSON.parse(text);
        if (Array.isArray(direct)) return direct;
        if (typeof direct === 'object' && direct !== null) return [direct];
        return [];
    } catch (e) {
        // 2. Try extracting from markdown code blocks ```json ... ```
        const markdownRegex = /```(?:json)?\s*([\s\S]*?)\s*```/g;
        let mdMatch;
        let foundMd = false;
        while ((mdMatch = markdownRegex.exec(text)) !== null) {
            foundMd = true;
            tryParse(mdMatch[1]);
        }
        if (foundMd && results.length > 0) return results;

        // 3. Balanced Bracket Extractor
        let depthArr = 0, depthObj = 0;
        let startArr = -1, startObj = -1;

        for (let i = 0; i < text.length; i++) {
            if (text[i] === '[') { if (depthArr === 0) startArr = i; depthArr++; }
            else if (text[i] === ']') { depthArr--; if (depthArr === 0 && startArr !== -1) { tryParse(text.substring(startArr, i + 1)); startArr = -1; } }
            else if (text[i] === '{') { if (depthObj === 0) startObj = i; depthObj++; }
            else if (text[i] === '}') { depthObj--; if (depthObj === 0 && startObj !== -1) { tryParse(text.substring(startObj, i + 1)); startObj = -1; } }
        }

        if (results.length > 0) return results;

        // 4. Final rescue: Largest substring between brackets
        const firstB = Math.min(text.indexOf('[') === -1 ? Infinity : text.indexOf('['), text.indexOf('{') === -1 ? Infinity : text.indexOf('{'));
        const lastB = Math.max(text.lastIndexOf(']'), text.lastIndexOf('}'));
        if (firstB !== Infinity && lastB !== -1 && lastB > firstB) {
            tryParse(text.substring(firstB, lastB + 1));
        }

        return results;
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
    if (Array.isArray(input)) {
        // Could be ["k:v", "k:v"] or [{"value":...}, {...}]
        return input.flatMap(item => {
            if (typeof item === 'object' && item !== null) {
                // If it's a deep object, recurse once to flatten
                return Object.entries(item).map(([k, v]) => {
                    if (typeof v === 'string') return `${k}: ${v}`;
                    return `${k}: ${JSON.stringify(v)}`;
                });
            }
            return item;
        });
    }
    if (typeof input === 'object' && input !== null) {
        // Did it return { "findings": [...] }?
        if (Array.isArray(input.findings)) return normalizeFindings(input.findings);
        if (Array.isArray(input.data)) return normalizeFindings(input.data);

        // Or just a k-v map?
        return Object.entries(input).map(([k, v]) => {
            if (typeof v === 'string') return `${k}: ${v}`;
            return `${k}: ${JSON.stringify(v)}`;
        });
    }
    return [];
}

// Validator Prompt for Strict Mode
// Note: The actual prompt is now generated dynamically inside extractPIILocal


export async function extractPIILocal(text: string, modelId: string = DEFAULT_OLLAMA_MODEL): Promise<PIIFinding[]> {
    if (!text || text.trim() === "") return [];

    console.log(`[OllamaLocal] Starting PII Discovery on ${text.length} chars (Model: ${modelId})...`);

    // 1. REGEX SNIPER (Trusted High/Medium/Low Confidence)
    const { scanTextCandidates } = await import('./regex-patterns');
    const candidates = scanTextCandidates(text);
    const regexCandidates = candidates.filter(c => ['HIGH', 'MEDIUM', 'LOW'].includes(c.confidence));

    // Value -> { type, label }
    const unifiedFindings = new Map<string, { type: string, label?: string }>();

    // Auto-accept Regex Candidates
    for (const c of regexCandidates) {
        unifiedFindings.set(c.value, { type: c.type, label: c.type });
    }

    // 2. LLM SWEEPER (Full Text Discovery)
    const isSmallModel = modelId.includes('1b') || modelId.includes('4b');
    const isReasoningModel = modelId.includes('gpt-oss') || modelId.includes('deepseek-r1') || modelId.includes('oss');
    const isLargeModel = !isSmallModel && !isReasoningModel;

    const MAX_LLM_CHARS = isSmallModel ? 16000 : 128000;
    const CONTEXT_WINDOW = 32768; // Standardized for robustness

    const llmText = text.length > MAX_LLM_CHARS
        ? text.substring(0, MAX_LLM_CHARS) + '\n[...]'
        : text;

    if (text.length > MAX_LLM_CHARS) {
        console.log(`[OllamaLocal] Text truncated for LLM: ${text.length} -> ${MAX_LLM_CHARS} chars`);
    }

    let prompt: string;
    const isOSSModel = modelId.includes('gpt-oss') || modelId.includes('oss');
    const useFullSchema = isLargeModel || isOSSModel;

    if (useFullSchema) {
        prompt = `Find PERSONAL data in the text for pseudonymization.
RULES:
1. Return ONLY a JSON array of objects: [{"category": "...", "value": "..."}].
2. Use the categories from the SCHEMA below.
3. For data not in schema, use "GENERIC_PII".
4. Return valid JSON. No descriptions, no explanations.
5. If no PII found, return [].

${PII_SCHEMA_DEFINITIONS}

Text:
${llmText}
`;
    } else {
        prompt = `List all personal data found in the text below as a JSON array of strings.
Format: ["CATEGORY: VALUE", ...]
Categories: NOME, INDIRIZZO, CONTATTO, CODICE_FISCALE, DOCUMENTO, DATA_NASCITA, LUOGO_NASCITA, SESSO, NAZIONALITA, DATI_SALUTE, DATI_FINANZIARI, RUOLO, PARTITA_IVA, GENERIC_PII
NO explanations. ONLY valid JSON.

Text:
${llmText}
`;
    }

    console.log(`[OllamaLocal] Using ${useFullSchema ? 'FULL' : 'SIMPLE'} prompt for model ${modelId}${isOSSModel ? ' (OSS reasoning)' : ''}`);

    try {
        const messages = [{ role: 'user', content: prompt }];
        const options: any = {
            temperature: 0.15,
            num_ctx: isOSSModel ? 32768 : CONTEXT_WINDOW,
            num_predict: isOSSModel ? 8192 : 1024,
            top_k: 20,
            top_p: 0.9
        };

        const payload: any = {
            model: modelId,
            messages,
            stream: false,
            options
        };

        // ONLY use format: 'json' for small models.
        // OSS/Reasoning models must remain "free" to think but return JSON (requested in prompt).
        if (!isOSSModel && isSmallModel) {
            payload.format = 'json';
        }
        if (isOSSModel) {
            payload.think = "low";
        }

        const data = await _extractWithRetry(payload, 2);
        let findings: any[] = [];

        // Extract response content (Strictly ignoring reasoning/thinking)
        let rawResponse = data.message?.content
            || data.choices?.[0]?.message?.content
            || data.choices?.[0]?.delta?.content
            || data.choices?.[0]?.text
            || data.response
            || (typeof data.raw === 'string' ? data.raw : '')
            || "";

        console.log(`[OllamaLocal] RAW RESPONSE (${rawResponse.length} chars): ${rawResponse}`);

        // Helper to parse a single line "KEY: VALUE"
        const parseLine = (line: string): { value: string, type: string, label: string } | null => {
            let cleanLine = line.trim()
                .replace(/^#{1,6}\s+/, '')
                .replace(/\*\*/g, '')
                .replace(/(?<!\w)\*(?!\*)/g, '')
                .replace(/^[-•]\s+/, '')
                .replace(/^\d+[\.\)]\s+/, '')
                .replace(/^"|",?$/g, '').replace(/^'|',?$/g, '')
                .replace(/`/g, '')
                .replace(/[\[\]]/g, '')
                .trim();

            cleanLine = cleanLine.replace(/^(TOKEN|PII|Label|Data)\s*[:=]\s*/i, '').trim();

            const match = cleanLine.match(/^\s*([A-Za-z0-9_ \-\.\'àèìòùÀÈÌÒÙ]+)\s*[:=]\s*(.+)\s*$/);
            if (!match) return null;

            let key = match[1].trim().toUpperCase();
            let val = match[2].trim();

            const GENERIC_KEYS = ['TOKEN', 'PII', 'DATA', 'VALUE', 'INFO', 'FINDING', 'ITEM'];
            if (GENERIC_KEYS.includes(key) && val.includes(':')) {
                const subMatch = val.match(/^\s*([A-Za-z0-9_ \-\.\']+)\s*[:=]\s*(.+)\s*$/);
                if (subMatch) {
                    key = subMatch[1].trim().toUpperCase();
                    val = subMatch[2].trim();
                }
            }

            val = val.replace(/",?$/, '').replace(/',?$/, '');

            if (val.length < 2) return null;
            if (key.length > 40) return null;
            if (key.includes("EXPLANATION") || key.includes("NOTE")) return null;

            if (key === 'CATEGORY' || key === 'CATEGORIES' || key === 'FORMAT' || key === 'SCHEMA') return null;

            // Map generic keys to our CATEGORIES
            let type = 'UNKNOWN';
            const has = (t: string) => key.includes(t);
            const isStrictIVA = key === 'IVA' || key === 'P_IVA' || key === 'P.IVA' || key === 'PARTITA_IVA' || key.startsWith('IVA_') || key.includes('_IVA') || (has('PARTITA') && has('IVA'));

            if (has('NAME') || has('NOME') || has('TITOLARE') || has('SOGGETTO') || has('COGNOME') || has('SURNAME')) type = 'NOME';
            else if (has('ADDRESS') || has('INDIRIZZO') || has('DOMICILIO') || has('CITY') || has('LOCATION')) type = 'INDIRIZZO';
            else if (has('LUOGO') && has('NASCITA')) type = 'LUOGO_NASCITA';
            else if (has('DATE') || has('DATA') || has('INIZIO') || has('FINE')) type = 'DATA';
            else if (isStrictIVA || has('VAT') || has('PIVA')) type = 'PARTITA_IVA';
            else if (has('CODICE') || has('FISCAL') || has('CF') || has('TAX')) type = 'CODICE_FISCALE';
            else if (has('CONTATTO') || has('MAIL') || has('EMAIL') || has('PHONE') || has('TEL') || has('CELL')) type = 'CONTATTO';
            else if (has('ORGANIZATION') || has('COMPANY') || has('DITTA') || has('SOCIETA') || has('BUSINESS') || has('DENOMINAZIONE')) return null;
            else if (has('IBAN') || has('BANK') || has('CONTO') || has('FINANZIAR')) type = 'DATI_FINANZIARI';
            else if (has('DOCUMENTO') || has('DOCUMENT')) type = 'DOCUMENTO';
            else if (has('RUOLO') || (has('PROFESSION') && !has('PROFESSIONISTA'))) type = 'RUOLO';
            else if (has('SALUTE') || has('HEALTH') || has('BIOMETRIC') || has('GENETIC')) type = 'DATI_SENSIBILI';
            else if (has('SESSO') || has('GENDER') || has('ORIENTAMENTO') || has('RELIGIOS') || has('POLITIC') || has('SINDACAL') || has('SINDACATO') || has('CONVINZION')) type = 'DATI_SENSIBILI';
            else if (has('NAZIONAL')) type = 'NAZIONALITA';
            else if (has('COMPORTAMENT')) type = 'DATI_COMPORTAMENTALI';
            else type = 'GENERIC_PII';

            const normalizedLabel = key.replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
            return { value: val, type, label: normalizedLabel };
        };

        const jsonRaw = extractJsonFromResponse(rawResponse);
        const jsonResult = normalizeFindings(jsonRaw);

        if (Array.isArray(jsonResult) && jsonResult.length > 0) {
            for (const item of jsonResult) {
                if (typeof item === 'string') {
                    const parsed = parseLine(item);
                    if (parsed) findings.push(parsed);
                } else if (typeof item === 'object') {
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

        if (findings.length === 0 && rawResponse.includes(':')) {
            const lines = rawResponse.split('\n');
            for (const line of lines) {
                const parsed = parseLine(line);
                if (parsed) findings.push(parsed);
            }
        }

        const seenValues = new Set<string>();
        findings = findings.filter(f => {
            const key = f.value.toLowerCase().trim();
            if (seenValues.has(key)) return false;
            seenValues.add(key);
            return true;
        });

        const isPlaceholder = (val: string) => {
            const v = val.toLowerCase().trim();
            const placeholders = ['john doe', 'jane doe', 'mario rossi', 'new york', '01/01/1980', '123 main st', 'san francisco'];
            return placeholders.some(p => v === p || v.includes(p) && v.length < p.length + 5);
        };
        findings = findings.filter(f => !isPlaceholder(f.value) && !isNoisyPII(f.value));

        for (const finding of findings) {
            if (finding.value && finding.value.length > 1) {
                const val = finding.value.trim();
                if (unifiedFindings.has(val)) {
                    const existing = unifiedFindings.get(val);
                    if (existing && existing.label === existing.type && finding.label && finding.label !== finding.type) {
                        unifiedFindings.set(val, { type: finding.type, label: finding.label });
                    }
                    continue;
                }
                const finalLabel = finding.label || finding.type;
                unifiedFindings.set(val, { type: finding.type, label: finalLabel });
            }
        }

    } catch (err) {
        console.error(`[OllamaLocal] LLM Full Text Extraction failed:`, err);
    }

    const finalResults: PIIFinding[] = [];
    for (const [value, data] of unifiedFindings.entries()) {
        finalResults.push({ value, category: data.type, label: data.label || data.type });
    }

    return finalResults;
}

/**
 * Esegue l'estrazione con logica di retry per gestire errori 503 (Ollama sovraccarico o in caricamento)
 */
async function _extractWithRetry(payload: any, retries = 3, delay = 2000, signal?: AbortSignal): Promise<any> {
    console.log(`[OllamaLocal] _extractWithRetry starting... (Model: ${payload.model})`);
    for (let i = 0; i < retries; i++) {
        try {
            console.log(`[OllamaLocal] Attempt ${i + 1}/${retries}: Sending request to ${currentBaseUrl}...`);
            const response = await smartFetch(`${currentBaseUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal,
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

/**
 * Uses LLM to unify similar PII values (fuzzy deduplication).
 * Returns a mapping: { "Original Value": "Canonical Value" }
 */
export async function unifyPIIFindings(
    values: string[],
    modelId: string = DEFAULT_OLLAMA_MODEL
): Promise<Record<string, string>> {
    if (!values || values.length <= 1) {
        const result: Record<string, string> = {};
        values.forEach(v => result[v] = v);
        return result;
    }

    // Filter out obvious noise before sending to LLM
    const filteredValues = values.filter(v => !isNoisyPII(v));
    if (filteredValues.length === 0) {
        console.warn("[OllamaLocal] No valid PII values to unify after filtering noise.");
        const identity: Record<string, string> = {};
        values.forEach(v => identity[v] = v);
        return identity;
    }

    // SKIP UNIFIER FOR SMALL MODELS (Gemma 1b/4b) per User Request
    // These models take 1-2 mins and don't provide enough value in unification
    // Large models (12b/27b/OSS) still use it.
    const isSmallModel = modelId.includes('1b') || modelId.includes('4b');
    const isOSSModel = modelId.includes('gpt-oss') || modelId.includes('oss');

    if (isSmallModel && !isOSSModel) {
        console.log(`[OllamaLocal] Skipping Unifier for small model: ${modelId}`);
        const identity: Record<string, string> = {};
        values.forEach(v => identity[v] = v);
        return identity;
    }

    const prompt = `Unify the following personal data strings. Group variations of the same entity (e.g. same address with different formatting, same name).
RULES:
1. Return ONLY a JSON object: {"variation": "canonical_value"}.
2. The "canonical_value" must be the most complete version from the list.
3. If a value is unique, map it to itself.
4. No explanations, no markdown, no other text.

Data list:
${filteredValues.join('\n')}
`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s for Unification

    try {
        const messages = [{ role: 'user', content: prompt }];
        const payload: any = {
            model: modelId,
            messages,
            stream: false,
            options: {
                temperature: 0.1,
                num_ctx: isOSSModel ? 32768 : 4096,
                num_predict: isOSSModel ? 4096 : 1024
            }
        };

        if (isOSSModel) {
            payload.think = "low";
        }
        // Local models (Gemma) do not support the 'think' field.

        const data = await _extractWithRetry(payload, 2, 2000, controller.signal);
        const rawResponse = data.message?.content
            || data.choices?.[0]?.message?.content
            || data.response
            || "";

        console.log(`[OllamaLocal] RAW UNIFIER RESPONSE: ${rawResponse.substring(0, 100)}...`);

        // Use robust JSON extraction
        const jsonList = extractJsonFromResponse(rawResponse);
        const result: Record<string, string> = {};

        // Convert the first object found in the response to our mapping
        if (jsonList.length > 0) {
            const map = jsonList[0];
            for (const key in map) {
                result[key] = String(map[key]);
            }
            console.log(`[OllamaLocal] PII Unifier: Mapped ${Object.keys(result).length} variations.`);
            return result;
        }

    } catch (err: any) {
        if (err.name === 'AbortError') {
            console.warn("[OllamaLocal] PII Unification TIMEOUT (60s) - returning identity map.");
        } else {
            console.error("[OllamaLocal] PII Unification failed:", err);
        }
    } finally {
        clearTimeout(timeoutId);
    }

    const fallback: Record<string, string> = {};
    values.forEach(v => fallback[v] = v);
    return fallback;
}
