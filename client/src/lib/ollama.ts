/**
 * Ollama Client Utility (Local-First)
 * Used to call localhost:11434 directly from the browser for Zero-Data privacy.
 */

export interface PIIFinding {
    value: string;
    category: string;
}

let currentBaseUrl = 'http://localhost:11434';
const OLLAMA_MODEL = 'gemma3:1b';

const CHUNK_SIZE = 2500; // Increased for better context
const CHUNK_OVERLAP = 300;

/**
 * Diagnostic utility to check if Ollama is reachable and has the model loaded.
 * Tries both localhost and 127.0.0.1 for maximum compatibility.
 */
export async function testOllamaConnection(): Promise<boolean> {
    const urls = [
        'http://localhost:11434',
        'http://127.0.0.1:11434'
    ];

    for (const url of urls) {
        try {
            console.log(`[OllamaLocal] Testing connection to ${url}...`);
            const response = await fetch(`${url}/api/tags`);
            if (!response.ok) continue;

            const data = await response.json();
            const models = data.models || [];
            const hasModel = models.some((m: any) => m.name.startsWith(OLLAMA_MODEL));

            if (hasModel) {
                console.log(`[OllamaLocal] Connection success via ${url}. Model ${OLLAMA_MODEL} found.`);
                currentBaseUrl = url; // Store successful URL
                return true;
            }
        } catch (err) {
            // Silently try the next URL
        }
    }

    console.error(`[OllamaLocal] All connection attempts failed.`);
    return false;
}

export async function extractPIILocal(text: string): Promise<PIIFinding[]> {
    if (!text || text.trim() === "") return [];

    // If text is short, process directly
    if (text.length <= CHUNK_SIZE) {
        return _extractSingleChunk(text);
    }

    // Handle long documents via chunking
    console.log(`[OllamaLocal] Long document detected (${text.length} chars). Using chunking...`);
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
            console.warn(`[OllamaLocal] Chunk processing failed at offset ${i}, skipping...`);
        }

        // Safety break
        if (i + CHUNK_SIZE >= text.length) break;
    }

    return allFindings;
}

async function _extractSingleChunk(text: string): Promise<PIIFinding[]> {
    console.log(`[OllamaLocal] Extracting PII from chunk (${text.length} chars)...`);

    const systemPrompt = `Sei un esperto di data privacy e protezione dati (DLP).
Identifica TUTTI i dati sensibili (PII) nel testo fornito.
Categorie: NOME_PERSONA, ORGANIZZAZIONE, INDIRIZZO, EMAIL, TELEFONO, CODICE_FISCALE, PARTITA_IVA.

ESEMPIO 1:
TESTO: Mi chiamo Carlo Galli e lavoro per CSD Station. Mail: carlo@galli.it
JSON: {"findings": [{"value": "Carlo Galli", "category": "NOME_PERSONA"}, {"value": "CSD Station", "category": "ORGANIZZAZIONE"}, {"value": "carlo@galli.it", "category": "EMAIL"}]}

ESEMPIO 2:
TESTO: L'ufficio è in Via Roma 10, Milano. Tel: 02 1234567. P.IVA 12345678901.
JSON: {"findings": [{"value": "Via Roma 10, Milano", "category": "INDIRIZZO"}, {"value": "02 1234567", "category": "TELEFONO"}, {"value": "12345678901", "category": "PARTITA_IVA"}]}

REGOLE:
1. Sostituisci i placeholder [DATO] con i valori reali estratti.
2. Se non trovi nulla, restituisci {"findings": []}.
3. Restituisci SOLO il JSON, niente chiacchiere.`;

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
            throw new Error(`Ollama unreachable (Status: ${response.status})`);
        }

        const data = await response.json();
        let rawResponse = data.message?.content || "";

        if (!rawResponse || rawResponse.trim() === "") {
            console.warn("[OllamaLocal] Empty response from model.");
            return [];
        }

        console.log(`[OllamaLocal] Raw model response:`, rawResponse);

        // Try to find JSON block if it's there
        const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
        const jsonToParse = jsonMatch ? jsonMatch[0] : rawResponse;

        try {
            const parsed = JSON.parse(jsonToParse);
            const findings = parsed.findings || [];
            console.log(`[OllamaLocal] Found ${findings.length} findings via JSON parse.`);
            return findings;
        } catch (e) {
            console.warn("[OllamaLocal] JSON parse failed, falling back to fuzzy regex.");
            // Fuzzy regex fallback: Extract ANYTHING that looks like a value/category pair
            const findings: PIIFinding[] = [];

            // Look for "value": "..." and "category": "..." even if not in the same object
            const valReg = /"value":\s*"([^"]+)"/g;
            const catReg = /"category":\s*"([^"]+)"/g;

            const values = [];
            const categories = [];

            let vMatch;
            while ((vMatch = valReg.exec(rawResponse)) !== null) values.push(vMatch[1]);

            let cMatch;
            while ((cMatch = catReg.exec(rawResponse)) !== null) categories.push(cMatch[1]);

            // Re-pair values and categories
            for (let i = 0; i < Math.min(values.length, categories.length); i++) {
                findings.push({ value: values[i], category: categories[i] });
            }

            console.log(`[OllamaLocal] Found ${findings.length} findings via Fuzzy Regex.`);
            return findings;
        }
    } catch (error) {
        console.error('[OllamaLocal] Extraction Error:', error);
        // Special check for connection errors (likely CORS or Ollama not running)
        if (error instanceof TypeError && error.message.includes('fetch')) {
            console.error('[OllamaLocal] Potential CORS or connection issue! Ensure OLLAMA_ORIGINS="*" is set if running outside localhost.');
        }
        throw error;
    }
}
