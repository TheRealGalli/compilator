import { VertexAI, HarmCategory, HarmBlockThreshold } from '@google-cloud/vertexai';
import mammoth from 'mammoth';

export class AiService {
    private vertex_ai: VertexAI;
    private projectId: string;
    private location: string;
    private modelId = 'gemini-2.5-flash';

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
     * Converts the square-based JSON board into a visual ASCII grid for the AI.
     */
    private renderBoardAsText(boardJson: any): string {
        const rows = [];
        const toAlgebraic = (r: number, c: number) => {
            const file = String.fromCharCode(97 + c);
            const rank = 8 - r;
            return `${file}${rank}`;
        };

        rows.push("   a   b   c   d   e   f   g   h");
        rows.push(" +---+---+---+---+---+---+---+---+");

        for (let r = 0; r < 8; r++) {
            let rowStr = `${8 - r}|`;
            for (let c = 0; c < 8; c++) {
                const coord = toAlgebraic(r, c);
                const piece = boardJson[coord];
                const display = (piece === "empty" || !piece) ? "  " : piece;
                rowStr += ` ${display}|`;
            }
            rows.push(rowStr + ` ${8 - r}`);
            rows.push(" +---+---+---+---+---+---+---+---+");
        }
        rows.push("   a   b   c   d   e   f   g   h");
        return rows.join("\n");
    }

    /**
     * Specialized method for Chess AI moves using Gemini 2.5 Flash.
     */
    async getChessMove(params: {
        boardJson: any,
        history: string[],
        illegalMoveAttempt?: { from: string, to: string, error: string, validMoves: string[] },
        allLegalMoves?: string[]
    }, retryCount = 0): Promise<{ from: string, to: string }> {
        try {
            const boardText = this.renderBoardAsText(params.boardJson);
            const legalMoves = params.allLegalMoves || [];

            // MOVE-FIRST PROTOCOL for debugging: Move tag at the top to avoid truncation
            const systemPrompt = `Sei GROMIT, un Grande Maestro di scacchi. Giochi con il colore BLU (b).
REGOLE DEL CAMPO (MOLTO IMPORTANTE):
- SCACCHIERA: Row 0/1 = Blu (tu), Row 6/7 = Bianco (nemico). Tu sei in alto, il Bianco in basso.
- PEDONI (P): Si muovono solo avanti (verso Row 7). Doppio passo solo dalla riga di partenza (Row 1). Catturano solo in diagonale avanti.
- EN PASSANT: Se un pedone nemico fa un doppio passo e atterra di fianco al tuo, puoi catturarlo muovendo in diagonale dietro di lui nel turno IMMEDIATAMENTE successivo.
- ARROCCO: Possibile solo se Re e Torre non si sono mai mossi e le caselle tra loro sono libere.
- PROMOZIONE: Se un tuo pedone raggiunge Row 7, diventa una Regina (Q).

PROTOCOLLO:
1. <move>origine-destinazione</move> (es. <move>e7-e5</move>).
2. Sotto, <thought>analisi breve.</thought>`;

            const historyText = params.history.length > 0 ? `Storico Partita: ${params.history.join(', ')}` : "Inizio partita.";
            const legalMovesText = legalMoves.length > 0 ?
                `\nMOSSE LEGALI PER TE (b): ${legalMoves.join(', ')}` : "";
            const illegalText = params.illegalMoveAttempt ? `\nERRORE PRECEDENTE: ${params.illegalMoveAttempt.from}-${params.illegalMoveAttempt.to} era illegale!` : "";

            const userPrompt = `SCACCHIERA:\n${boardText}\n\n${historyText}${legalMovesText}${illegalText}\n\nMossa per b:`;

            const model = this.vertex_ai.getGenerativeModel({
                model: this.modelId,
                systemInstruction: {
                    role: 'system',
                    parts: [{ text: systemPrompt }]
                }
            });

            console.log(`[AiService] GROMIT (b) is thinking... (Attempt ${retryCount + 1})`);

            const result = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
                generationConfig: {
                    maxOutputTokens: 600,
                    temperature: 0.1
                }
            });

            const candidate = result.response.candidates?.[0];
            const rawContent = candidate?.content?.parts?.map((p: any) => p.text || '').join('') || '';
            console.log(`[AiService] Full Response:\n${rawContent}`);

            // 1. EXTRACT MOVE
            const moveTagMatch = rawContent.match(/<move>\s*([a-h][1-8])\s*[- >toa]*\s*([a-h][1-8])\s*<\/move>/i);

            if (moveTagMatch) {
                const move = { from: moveTagMatch[1].toLowerCase(), to: moveTagMatch[2].toLowerCase() };
                console.log(`[AiService] Extracted: ${move.from}-${move.to}`);
                return move;
            }

            // 2. BACKUP EXTRACTION (Only if tag is missing but coords are there)
            const coords = rawContent.match(/([a-h][1-8])\s*[- >toa]*\s*([a-h][1-8])/gi);
            if (coords && coords.length > 0) {
                const parts = coords[0].match(/([a-h][1-8])/gi);
                if (parts && parts.length === 2) {
                    return { from: parts[0].toLowerCase(), to: parts[1].toLowerCase() };
                }
            }

            throw new Error(`GROMIT non ha fornito una mossa chiara: "${rawContent.substring(0, 100)}..."`);

        } catch (error: any) {
            console.error('[AiService] Chess Error:', error);
            throw error;
        }
    }
}
