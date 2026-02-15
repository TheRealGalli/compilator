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
    return new Promise((resolve) => {
        const requestId = Math.random().toString(36).substring(7);
        const timeout = setTimeout(() => {
            window.removeEventListener('GROMIT_BRIDGE_RESPONSE', handler);
            console.warn(`[GromitBridge] TIMEOUT su ${url} dopo 120s`);
            resolve({ success: false, error: 'TIMEOUT (Estensione non risponde)', status: 408 });
        }, 120000);

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
    // 1. Robust Bridge Check with Retry
    let bridgeActive = isBridgeAvailable();
    if (!bridgeActive) {
        // Retry once mainly for init race conditions
        await new Promise(r => setTimeout(r, 500));
        bridgeActive = isBridgeAvailable();
    }

    if (bridgeActive) {
        console.log(`[OllamaLocal] Using GROMIT BRIDGE for ${url}`);
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
            console.warn(`[OllamaLocal 5.3.4] Bridge Error for ${url}: ${errorMsg} (Status: ${status})`);

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
    // Regex runs on FULL text above, but LLM has a context window limit (num_ctx: 4096 ≈ 3k tokens).
    // We truncate text for the LLM only to avoid 120s timeouts on large documents.
    // 2. LLM SWEEPER (Full Text Discovery)
    // Regex runs on FULL text above, but LLM has a context window limit (num_ctx: 4096 ≈ 3k tokens).
    // We truncate text for the LLM only to avoid 120s timeouts on large documents.
    const MAX_LLM_CHARS = 4500;
    const llmText = text.length > MAX_LLM_CHARS
        ? text.substring(0, MAX_LLM_CHARS) + '\n[...]'
        : text;

    if (text.length > MAX_LLM_CHARS) {
        console.log(`[OllamaLocal] Text truncated for LLM: ${text.length} -> ${MAX_LLM_CHARS} chars (regex ran on full text)`);
    }

    // ULTRA-CONCISE PROMPT (User's Proven Prompt)
    // We use the exact phrasing that worked in chat.
    const prompt = `find PERSONAL data in the text and do a token for pseuddonimiz it , return only the list of DATA as a tokenized format.
IMPORTANT RULES:
1. You have a strict limit of 1024 tokens. BE CONCISE.
2. Return ONLY a list in this format: "TOKEN: VALUE".
3. If you find a value but don't know the category, use "General_PII".
4. Do NOT include descriptions, explanations, or markdown formatting like **bold**.
5. IF NO PII IS FOUND, RETURN AN EMPTY LIST. DO NOT INVENT DATA.

EXAMPLE INPUT:
"John Doe was born in New York on 01/01/1980."

EXAMPLE OUTPUT:
FULL_NAME: John Doe
PLACE_OF_BIRTH: New York
DATE_OF_BIRTH: 01/01/1980

Text:
${llmText}
`;

    // DEBUG: Removed sensitive prompt log

    try {
        const payload = {
            model: OLLAMA_MODEL,
            messages: [{ role: 'user', content: prompt }],
            stream: false,
            // format: 'json', // REMOVE JSON FORMAT ENFORCEMENT - Let it speak naturally
            options: {
                temperature: 0.15, // Slightly bumped to avoid repetitive loops
                num_ctx: 4096, // Context window
                num_predict: 1024, // CAP OUTPUT to ~750 words to prevent infinite loops (Critical for 120s timeout)
                top_k: 20,
                top_p: 0.9
            }
        };

        const data = await _extractWithRetry(payload, 2);
        let findings: any[] = [];
        let rawResponse = data.message?.content || "";

        console.log("[OllamaLocal] RAW RESPONSE PREVIEW:", rawResponse.substring(0, 500) + "..."); // DEBUG: Inspect model output

        // Helper to parse a single line "KEY: VALUE"
        const parseLine = (line: string): { value: string, type: string, label: string } | null => {
            // Pre-clean: Remove markdown formatting, list markers, quotes, trailing commas
            let cleanLine = line.trim()
                .replace(/^#{1,6}\s+/, '')        // Remove markdown headers (# ## ### etc.)
                .replace(/\*\*/g, '')              // Remove bold **text**
                .replace(/(?<!\w)\*(?!\*)/g, '')   // Remove italic *text* (not **)
                .replace(/^[-•]\s+/, '')           // Remove list markers (- •)
                .replace(/^\d+[\.\)]\s+/, '')      // Remove numbered list markers (1. 2) etc.)
                .replace(/^"|",?$/g, '').replace(/^'|',?$/g, '')  // Remove surrounding quotes
                .replace(/`/g, '')                 // Remove inline code backticks
                .trim();

            // Matches: "NAME: Mario Rossi", "P.IVA: 123"
            const match = cleanLine.match(/^\s*([A-Za-z0-9_ \-\.\'àèìòùÀÈÌÒÙ]+)\s*[:=]\s*(.+)\s*$/);
            if (!match) return null;

            const key = match[1].trim().toUpperCase();
            let val = match[2].trim();

            // Remove potential trailing quotes/comma from value if regex missed them
            val = val.replace(/",?$/, '').replace(/',?$/, '');

            // Simple hygiene
            if (val.length < 2) return null;
            if (key.includes("EXPLANATION") || key.includes("NOTE")) return null;

            // QUALITY FILTER: Reject values that are descriptions, not actual data.
            // Real PII: "Carlo Galli", "36-5157311", "VIA CAMPANA 45"
            // Garbage:  "The country where the corporation is incorporated"
            const valLower = val.toLowerCase();
            const DESCRIPTION_STARTERS = /^(the |a |an |whether |if |this |that |it |for |which |where |when |how |used |refers |indicates |specifies |describes |represents |shows )/i;
            if (DESCRIPTION_STARTERS.test(val)) return null;
            // Reject values with too many common English words (description pattern)
            const descWords = valLower.split(/\s+/);
            const FILLER_WORDS = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'of', 'for', 'to', 'in', 'on', 'at', 'by', 'with', 'from', 'or', 'and', 'not', 'if', 'whether', 'that', 'which', 'where', 'when', 'how', 'has', 'have', 'had', 'does', 'do', 'did']);
            const fillerCount = descWords.filter(w => FILLER_WORDS.has(w)).length;
            if (descWords.length >= 4 && fillerCount / descWords.length > 0.4) return null;

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

        // SANITY FILTER: Remove placeholder hallucinations (John Doe, etc.)
        const isPlaceholder = (val: string) => {
            const v = val.toLowerCase().trim();
            const placeholders = ['john doe', 'jane doe', 'mario rossi', 'new york', '01/01/1980', '123 main st', 'san francisco'];
            return placeholders.some(p => v === p || v.includes(p) && v.length < p.length + 5);
        };
        findings = findings.filter(f => !isPlaceholder(f.value));

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
