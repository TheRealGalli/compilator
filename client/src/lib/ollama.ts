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

const CHUNK_SIZE = 2500;
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
            resolve({ success: false, error: 'TIMEOUT' });
        }, 5000);

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
        // Se il bridge è presente ma fallisce (es. Ollama spento), non ripieghiamo su fetch diretta
        // per evitare di sporcare i log con errori CORS inutili.
        return { ok: false, status: 503, json: async () => ({ error: 'Ollama unreachable via bridge' }) };
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
                console.error('[OllamaLocal] BLOCCO CORS or MIXED CONTENT detector.');
                console.group('--- COME RISOLVERE (Mac) ---');
                console.info('1. Chiudi Ollama completamente (dalla barra menu).');
                console.info('2. Esegui questo comando nel Terminale:');
                console.info('   launchctl setenv OLLAMA_ORIGINS "https://therealgalli.github.io,http://localhost*,http://127.0.0.1*,chrome-extension://*"');
                console.info('3. Riavvia Ollama.');
                console.info('4. Se ancora non va, clicca sul LUCCHETTO -> Impostazioni sito -> Contenuti non sicuri -> CONSENTI.');
                console.groupEnd();
            } else if (lastError instanceof Error && lastError.message.includes('403')) {
                console.error('[OllamaLocal] ERRORE 403 (FORBIDDEN).');
                console.group('--- COME RISOLVERE IL 403 (Mac) ---');
                console.info('L\'estensione non ha i permessi per parlare con Ollama.');
                console.info('1. Chiudi Ollama completamente.');
                console.info('2. Esegui questo comando:');
                console.info('   launchctl setenv OLLAMA_ORIGINS "https://therealgalli.github.io,http://localhost*,http://127.0.0.1*,chrome-extension://*"');
                console.info('3. Riavvia Ollama.');
                console.groupEnd();
            } else {
                console.error('[OllamaLocal] Errore imprevisto di rete:', lastError);
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
        } catch (err) {
            console.warn(`[OllamaLocal] Errore durante il chunking a offset ${i}, salto...`);
        }
        if (i + CHUNK_SIZE >= text.length) break;
    }

    return allFindings;
}

async function _extractSingleChunk(text: string): Promise<PIIFinding[]> {
    console.log(`[OllamaLocal] Estrazione PII dal chunk (${text.length} caratteri)...`);

    const systemPrompt = `Sei un esperto di data privacy e protezione dati (DLP).
Identifica TUTTI i dati sensibili (PII) nel testo fornito.
Categorie: NOME_PERSONA, ORGANIZZAZIONE, INDIRIZZO, EMAIL, TELEFONO, CODICE_FISCALE, PARTITA_IVA.

ESEMPIO 1:
TESTO: Mi chiamo Carlo Galli e lavoro per CSD Station. Mail: carlo@galli.it
JSON: {"findings": [{"value": "Carlo Galli", "category": "NOME_PERSONA"}, {"value": "CSD Station", "category": "ORGANIZZAZIONE"}, {"value": "carlo@galli.it", "category": "EMAIL"}]}

REGOLE:
1. Restituisci SOLO il JSON, niente chiacchiere.
2. Se non trovi nulla, restituisci {"findings": []}.`;

    try {
        const response = await smartFetch(`${currentBaseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: OLLAMA_MODEL,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `ANALIZZA QUESTO TESTO:\n\n${text}` }
                ],
                format: 'json',
                stream: false,
                options: {
                    temperature: 0.1,
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Ollama non raggiungibile (Status: ${response.status})`);
        }

        const data = await response.json();
        let rawResponse = data.message?.content || "";

        try {
            const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
            const jsonToParse = jsonMatch ? jsonMatch[0] : rawResponse;
            const parsed = JSON.parse(jsonToParse);
            return parsed.findings || [];
        } catch (e) {
            console.warn("[OllamaLocal] Parse JSON fallito, provo fallback regex.");
            const findings: PIIFinding[] = [];
            const valReg = /"value":\s*"([^"]+)"/g;
            const catReg = /"category":\s*"([^"]+)"/g;
            const values = [];
            const categories = [];
            let vMatch, cMatch;
            while ((vMatch = valReg.exec(rawResponse)) !== null) values.push(vMatch[1]);
            while ((cMatch = catReg.exec(rawResponse)) !== null) categories.push(cMatch[1]);
            for (let i = 0; i < Math.min(values.length, categories.length); i++) {
                findings.push({ value: values[i], category: categories[i] });
            }
            return findings;
        }
    } catch (error) {
        if (error instanceof Error && error.message.includes('403')) {
            console.error('[OllamaLocal] ERRORE 403 (FORBIDDEN) in estrazione.');
            console.group('--- COME RISOLVERE (Mac) ---');
            console.info('Ollama rifiuta la richiesta dell\'estensione.');
            console.info('1. Chiudi Ollama completamente.');
            console.info('2. Esegui questo comando correttivo:');
            console.info('   launchctl setenv OLLAMA_ORIGINS "https://therealgalli.github.io,http://localhost*,http://127.0.0.1*,chrome-extension://*"');
            console.info('3. Riavvia Ollama.');
            console.groupEnd();
        }
        console.error('[OllamaLocal] Errore estrazione:', error);
        throw error;
    }
}
