import { VertexAI } from '@google-cloud/vertexai';
import mammoth from 'mammoth';

export class AiService {
    private vertex_ai: VertexAI;
    private projectId: string;
    private location: string;
    private modelId = 'gemini-1.5-flash';

    constructor(projectId: string, location: string = 'europe-west1') {
        this.projectId = projectId;
        this.location = location;
        this.vertex_ai = new VertexAI({ project: projectId, location: location });

        console.log(`[AiService] Initialized with model: ${this.modelId} in ${location}`);
    }

    /**
     * Public helper to process multimodal files once and reuse across passes.
     */
    async processMultimodalParts(files: any[]): Promise<any[]> {
        return Promise.all(files.map(async (file) => {
            const mimeType = file.mimeType || file.type || '';
            const base64Data = file.data || file.base64 || '';

            if (!mimeType || !base64Data) return null;

            const isMultimodal =
                mimeType.startsWith('image/') ||
                mimeType === 'application/pdf' ||
                mimeType.startsWith('audio/') ||
                mimeType.startsWith('video/') ||
                mimeType === 'text/markdown' ||
                mimeType === 'application/rtf' ||
                mimeType === 'text/rtf' ||
                mimeType === 'application/json' ||
                mimeType === 'text/html' ||
                mimeType === 'application/xml' ||
                mimeType === 'text/xml';

            const isDOCX = mimeType.includes('wordprocessingml') || mimeType.includes('msword');

            if (isDOCX) {
                try {
                    console.log(`[AiService] Extracting text from DOCX file for Gemini pass...`);
                    const buffer = Buffer.from(base64Data, 'base64');
                    const { value: text } = await mammoth.extractRawText({ buffer });
                    return { text: `[CONTENUTO DOCUMENTO WORD]:\n${text}` };
                } catch (err) {
                    console.error('[AiService] Error extracting DOCX text:', err);
                    return null;
                }
            } else if (isMultimodal) {
                return {
                    inlineData: {
                        mimeType: mimeType,
                        data: base64Data
                    }
                };
            } else {
                // Fallback to text decoding for unknown/plain types
                try {
                    const text = Buffer.from(base64Data, 'base64').toString('utf-8');
                    return { text: `[CONTENUTO FILE ${mimeType}]:\n${text}` };
                } catch (err) {
                    console.error('[AiService] Fallback text extraction failed:', err);
                    return null;
                }
            }
        })).then(parts => parts.filter(p => p !== null));
    }

    /**
     * Compiles the document using strict context from sources.
     */
    async compileDocument(params: {
        systemPrompt: string,
        userPrompt: string,
        multimodalFiles: any[],
        masterSource?: any,
        preProcessedParts?: any[]
    }): Promise<{ content: string, parts?: any[] }> {
        try {
            const model = this.vertex_ai.getGenerativeModel({
                model: this.modelId,
                systemInstruction: {
                    role: 'system',
                    parts: [{ text: params.systemPrompt }]
                }
            });

            // Use pre-processed parts if provided to save latency
            // Parallel pre-processing
            const [multimodalParts, masterParts] = await Promise.all([
                params.preProcessedParts ? Promise.resolve(params.preProcessedParts) : this.processMultimodalParts(params.multimodalFiles),
                (params.masterSource && params.masterSource.base64) ? this.processMultimodalParts([params.masterSource]) : Promise.resolve([])
            ]);

            const messageParts: any[] = [{ text: params.userPrompt }, ...multimodalParts, ...masterParts];

            const result = await model.generateContent({
                contents: [{ role: 'user', parts: messageParts }],
                generationConfig: {
                    maxOutputTokens: 50000,
                    temperature: 0.2
                }
            });

            const content = result.response.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '';
            return { content, parts: multimodalParts };

        } catch (error) {
            console.error('[AiService] compileDocument error:', error);
            throw error;
        }
    }

    async refineFormatting(params: {
        draftContent: string,
        masterSource?: any,
        formalTone?: boolean,
        preProcessedMasterParts?: any[]
    }): Promise<string> {
        try {
            const systemPrompt = `Sei l'Agente Layout di Gromit, esperto in Advanced Desktop Publishing e Document Design.
Il tuo compito è prendere una BOZZA di testo e rifinirla esteticamente SENZA ALTERARE I DATI.

**REGOLE D'ORO (LAYOUT AGENT):**
1. **STRUTTURA PROFESSIONALE:** 
   - Se i dati sono strutturati (es: liste di persone, elenchi di beni, coordinate catastali, importi), usa **elenchi puntati** o **elenchi numerati**.
   - **NON** usare tabelle markdown per garantire la compatibilità con l'esportazione DOCX.

2. **GERARCHIA VISIVA:** 
   - Usa Markdown standard (# Titolo, ## Sottotitolo).
   - **DATI IN GRASSETTO:** Assicurati che ogni dato compilato, nome, data o importo sia racchiuso tra doppi asterischi (es: **Dato**).
   - Usa il **grassetto** per termini chiave e sezioni importanti.

3. **MASTER ALIGNMENT:** 
   - Se fornito un "Master Source", imita la sua struttura delle sezioni e il suo stile.

**RESTRIZIONI:**
- Restituisci SOLO il testo rifinito.
- Non aggiungere commenti personali.
- Mantieni rigorosamente i dati della bozza originale.`;

            const userPrompt = `Rifinisci la formattazione di questa bozza seguendo le regole di layout. Usa elenchi puliti e strutturati dove vedi dati ripetitivi.
${params.formalTone ? "Usa un tono professionale e formale." : ""}

BOZZA DA RIFINIRE:
${params.draftContent}`;

            const model = this.vertex_ai.getGenerativeModel({
                model: this.modelId,
                systemInstruction: {
                    role: 'system',
                    parts: [{ text: systemPrompt }]
                }
            });

            const masterParts = params.preProcessedMasterParts || (params.masterSource ? await this.processMultimodalParts([params.masterSource]) : []);
            const messageParts: any[] = [{ text: userPrompt }, ...masterParts];

            const result = await model.generateContent({
                contents: [{ role: 'user', parts: messageParts }],
                generationConfig: {
                    maxOutputTokens: 50000,
                    temperature: 0.1
                }
            });

            return result.response.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || params.draftContent;

        } catch (error) {
            console.error('[AiService] refineFormatting error:', error);
            return params.draftContent;
        }
    }

    /**
     * Specialized method for Chess AI moves using Gemini 2.5 Flash.
     */
    async getChessMove(params: {
        boardJson: any,
        history: string[],
        illegalMoveAttempt?: { from: string, to: string, error: string, validMoves: string[] }
    }): Promise<{ from: string, to: string }> {
        const systemPrompt = `Sei l'Agente SCACCHI di Gromit, un Gran Maestro internazionale.
Stai giocando con i pezzi BLU (che nel sistema corrispondono ai neri 'b') contro un UTENTE che gioca con i bianchi ('w').

**COORDINATE E ORIENTAMENTO:**
- Usa la notazione algebrica standard (a1-h8).
- Pezzi BLU (neri) iniziano sulle righe 7 e 8. I tuoi pedoni (bP) si muovono verso la riga 1.
- Pezzi BIANCHI iniziano sulle righe 1 e 2. Si muovono verso la riga 8.

**REGOLE DI MOVIMENTO E CATTURA:**
1. **Pedoni (bP):** Muovono avanti verso la riga 1. Alla PRIMA mossa possono fare 2 passi. Catturano SOLO in diagonale avanti.
2. **Obiettivo:** Cattura i pezzi bianchi e proteggi il tuo Re. Scegli la mossa tatticamente migliore.
3. **Pezzi Blu:** bR, bN, bB, bQ, bK, bP.
4. **Pezzi Bianchi:** wR, wN, wB, wQ, wK, wP.

**PROTOCOLLO DI RISPOSTA:**
- Analizza la scacchiera JSON (64 caselle).
- Rispondi ESCLUSIVAMENTE con un JSON: { "from": "...", "to": "..." }.
- Non aggiungere testo extra o spiegazioni.
- Se ricevi un errore "mossa illegale", significa che la mossa violava le regole FIDE. Correggi usando i suggerimenti.`;

        const historyText = params.history.length > 0 ? `Storico mosse: ${params.history.join(', ')}` : "Inizio partita.";
        const illegalText = params.illegalMoveAttempt ?
            `\nATTENZIONE: La tua mossa precedente (${params.illegalMoveAttempt.from} -> ${params.illegalMoveAttempt.to}) era ILLEGALE. Errore: ${params.illegalMoveAttempt.error}. Mosse valide per quel pezzo: ${params.illegalMoveAttempt.validMoves.join(', ')}.` : "";

        const userPrompt = `Ecco la scacchiera attuale:
${JSON.stringify(params.boardJson, null, 2)}

${historyText}${illegalText}

Qual è la tua prossima mossa? Rispondi solo in JSON.`;

        const model = this.vertex_ai.getGenerativeModel({
            model: this.modelId,
            systemInstruction: {
                role: 'system',
                parts: [{ text: systemPrompt }]
            }
        });

        console.log(`[AiService] Sending Chess Prompt to ${this.modelId}...`);

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            generationConfig: {
                maxOutputTokens: 100,
                temperature: 0.3,
                responseMimeType: 'application/json'
            }
        });

        const content = result.response.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '{}';
        console.log(`[AiService] Raw AI Response Content: "${content}"`);

        try {
            const move = JSON.parse(content);
            if (!move.from || !move.to) {
                console.warn('[AiService] AI returned JSON without from/to fields:', move);
            }
            return move;
        } catch (e) {
            console.error('[AiService] Chess Move JSON parse error:', e, content);
            throw new Error('AI non ha restituito un JSON valido per la mossa.');
        }
    }
}

