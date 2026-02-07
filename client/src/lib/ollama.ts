/**
 * Ollama Client Utility (Local-First)
 * Used to call localhost:11434 directly from the browser for Zero-Data privacy.
 */

export interface PIIFinding {
    value: string;
    category: string;
}

const OLLAMA_URL = 'http://localhost:11434/api/generate';
const OLLAMA_MODEL = 'gemma3:1b';

const CHUNK_SIZE = 1500;
const CHUNK_OVERLAP = 200;

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

    const systemPrompt = `[INST] Sei un Agente di Estrazione Dati. Identifica TUTTI i dati sensibili.
Categorie: NOME_PERSONA, ORGANIZZAZIONE, INDIRIZZO, EMAIL, TELEFONO, CODICE_FISCALE, PARTITA_IVA.

ESEMPIO 1:
TESTO: Mi chiamo Carlo Galli e lavoro per CSD Station. Mail: carlo@galli.it
JSON: {"findings": [{"value": "Carlo Galli", "category": "NOME_PERSONA"}, {"value": "CSD Station", "category": "ORGANIZZAZIONE"}, {"value": "carlo@galli.it", "category": "EMAIL"}]}

ESEMPIO 2:
TESTO: L'ufficio è in Via Roma 10, Milano. Tel: 02 1234567. P.IVA 12345678901.
JSON: {"findings": [{"value": "Via Roma 10, Milano", "category": "INDIRIZZO"}, {"value": "02 1234567", "category": "TELEFONO"}, {"value": "12345678901", "category": "PARTITA_IVA"}]}

REGOLE:
- Copia il valore ESATTAMENTE come nel testo.
- Includi i nomi completi.
- Restituisci SOLO il JSON.

TESTO:
${text} [/INST]`;

    try {
        const response = await fetch(OLLAMA_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: OLLAMA_MODEL,
                prompt: systemPrompt,
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
        const rawResponse = data.response || "";

        if (!rawResponse || rawResponse.trim() === "") {
            return [];
        }

        try {
            const parsed = JSON.parse(rawResponse);
            return parsed.findings || [];
        } catch (e) {
            console.error("[OllamaLocal] FAILED to parse JSON, trying regex fallback:", rawResponse);
            const findings: PIIFinding[] = [];
            const regex = /"value":\s*"([^"]+)",\s*"category":\s*"([^"]+)"/g;
            let match;
            while ((match = regex.exec(rawResponse)) !== null) {
                findings.push({ value: match[1], category: match[2] });
            }
            return findings;
        }
    } catch (error) {
        console.error('[OllamaLocal] Extraction Error:', error);
        throw error;
    }
}
