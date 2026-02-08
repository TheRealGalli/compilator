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
 * Utility di diagnostica per verificare se Ollama è raggiungibile e ha il modello caricato.
 * Prova sia localhost che 127.0.0.1 per massima compatibilità.
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

            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), 2000);

            const response = await fetch(`${url}/api/tags`, { signal: controller.signal });
            clearTimeout(id);

            if (!response.ok) {
                console.warn(`[OllamaLocal] ${url} risponde, ma con errore ${response.status}`);
                continue;
            }

            const data = await response.json();
            const models = (data.models || []).map((m: any) => m.name.toLowerCase());
            anySuccess = true;

            // Controllo per gemma3:1b con varianti di tag o latest
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
                console.warn(`[OllamaLocal] Ollama attivo su ${url}, ma il modello '${OLLAMA_MODEL}' non è stato trovato.`);
                console.log(`[OllamaLocal] Modelli installati:`, models);
                console.info(`[OllamaLocal] SOLUZIONE: Esegui 'ollama pull ${OLLAMA_MODEL}' nel terminale.`);
            }
        } catch (err) {
            lastError = err;
        }
    }

    if (!anySuccess && lastError) {
        if (lastError.name === 'AbortError') {
            console.error('[OllamaLocal] Timeout connessione. Ollama è aperto?');
        } else if (lastError instanceof TypeError && lastError.message.includes('fetch')) {
            console.error('[OllamaLocal] BLOCCO DEL BROWSER RILEVATO (Mixed Content o CORS).');
            console.error('[OllamaLocal] 1. Clicca sul LUCCHETTO nella barra degli indirizzi di Chrome.');
            console.error('[OllamaLocal] 2. Vai in "Impostazioni Sito".');
            console.error('[OllamaLocal] 3. Trova "Contenuti non sicuri" e impostalo su "CONSENTI".');
            console.error('[OllamaLocal] 4. Assicurati di aver impostato OLLAMA_ORIGINS="*" se Ollama è su un PC diverso.');
        } else {
            console.error('[OllamaLocal] Errore di connessione:', lastError);
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
        const response = await fetch(`${currentBaseUrl}/api/chat`, {
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
        console.error('[OllamaLocal] Errore estrazione:', error);
        throw error;
    }
}
