/**
 * Ollama Client Utility (Local-First)
 * Used to call localhost:11434 directly from the browser for Zero-Data privacy.
 */

export interface PIIFinding {
    value: string;
    category: string;
}

const OLLAMA_URL = 'http://localhost:11434/api/chat';
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

    const systemPrompt = `Sei un esperto di data privacy e protezione dati (DLP).
Identifica TUTTI i dati sensibili (PII) nel testo fornito dall'utente.
Categorie: NOME_PERSONA, ORGANIZZAZIONE, INDIRIZZO, EMAIL, TELEFONO, CODICE_FISCALE, PARTITA_IVA.

Formatta la risposta ESCLUSIVAMENTE come JSON:
{"findings": [{"value": "il dato", "category": "CATEGORIA"}]}

REGOLE:
1. Estrai il valore esattamente come scritto.
2. Identifica nomi e cognomi completi.
3. Se non trovi nulla, restituisci {"findings": []}.
4. Restituisci SOLO il JSON, niente chiacchiere o markdown.`;

    try {
        const response = await fetch(OLLAMA_URL, {
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

        // Clean up markdown noise
        rawResponse = rawResponse.replace(/```json/g, "").replace(/```/g, "").trim();

        try {
            const parsed = JSON.parse(rawResponse);
            const findings = parsed.findings || [];
            console.log(`[OllamaLocal] Identified ${findings.length} sensitive fields.`);
            return findings;
        } catch (e) {
            console.error("[OllamaLocal] FAILED to parse JSON:", rawResponse);
            // Regex fallback
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
