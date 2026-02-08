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

    const systemPrompt = `Sei un esperto di privacy. Il tuo compito è identificare TUTTI i dati sensibili nel testo fornito.
Categorie: NOME_PERSONA, ORGANIZZAZIONE, INDIRIZZO, EMAIL, TELEFONO, CODICE_FISCALE, PARTITA_IVA.

Formatta la risposta ESCLUSIVAMENTE come un oggetto JSON:
{"findings": [{"value": "valore", "category": "CATEGORIA"}]}

REGOLE:
1. Estrai il valore esattamente come appare nel testo.
2. Includi nomi completi.
3. Se non trovi nulla, restituisci {"findings": []}.
4. NON aggiungere altro testo, solo il JSON.

TESTO:
${text}`;

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
        let rawResponse = data.response || "";

        if (!rawResponse || rawResponse.trim() === "") {
            return [];
        }

        // Remove markdown code blocks
        rawResponse = rawResponse.replace(/```json/g, "").replace(/```/g, "").trim();

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
