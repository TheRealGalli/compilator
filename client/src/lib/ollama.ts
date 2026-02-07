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

export async function extractPIILocal(text: string): Promise<PIIFinding[]> {
    if (!text || text.trim() === "") return [];

    console.log(`[OllamaLocal] Calling local Ollama for PII Extraction...`);

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
