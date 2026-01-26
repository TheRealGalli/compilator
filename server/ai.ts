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
        allLegalMoves?: string[] // Optional list of strings like "a2-a4", "g8-f6"
    }): Promise<{ from: string, to: string }> {
        try {
            const boardText = this.renderBoardAsText(params.boardJson);
            // HYPER-SPEED PROMPT
            const systemPrompt = `Sei GROMIT (b).
OUTPUT SOLO: <move>origine-destinazione</move> (es. <move>e7-e5</move>).
PEZZI: b=Blu, w=Bianco, P=Pedone, R=Torre, N=Cavallo, B=Alfiere, Q=Regina, K=Re.
REGOLE: Nessun testo extra. Solo il tag.`;

            const historyText = params.history.length > 0 ? `Storico: ${params.history.join(', ')}` : "Inizio.";
            const legalMovesText = (params.allLegalMoves && params.allLegalMoves.length > 0) ?
                `\nMOSSE LEGALI: ${params.allLegalMoves.join(', ')}` : "";
            const illegalText = params.illegalMoveAttempt ? `\nERRORE PRECEDENTE: ${params.illegalMoveAttempt.from}-${params.illegalMoveAttempt.to} ILLEGALE!` : "";

            const userPrompt = `SCACCHIERA:\n${boardText}\n${historyText}${legalMovesText}${illegalText}\nProtocollo: <move> mossa </move>`;

            const model = this.vertex_ai.getGenerativeModel({
                model: this.modelId,
                systemInstruction: {
                    role: 'system',
                    parts: [{ text: systemPrompt }]
                },
                safetySettings: [
                    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                ]
            });

            console.log(`[AiService] Grandmaster GROMIT is thinking (${this.modelId})...`);

            const result = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
                generationConfig: {
                    maxOutputTokens: 20, // Optimization: We only need the move tag
                    temperature: 0.1     // Optimization: Max deterministic speed
                }
            });

            if (!result.response.candidates || result.response.candidates.length === 0) {
                console.error('[AiService] GROMIT silent.');
                throw new Error('GROMIT non ha risposto.');
            }

            const rawContent = result.response.candidates[0].content?.parts?.map((p: any) => p.text || '').join('') || '';
            console.log(`[AiService] Full GROMIT Thought Process:\n${rawContent}`);

            // PRIORITY 1: XML Tag Extraction (<move>e2-e4</move>)
            const tagBlock = rawContent.match(/<move>([\s\S]*?)<\/move>/i);
            if (tagBlock) {
                const inner = tagBlock[1];
                const coords = inner.match(/([a-h][1-8])/gi);
                if (coords && coords.length >= 2) {
                    const from = coords[coords.length - 2].toLowerCase();
                    const to = coords[coords.length - 1].toLowerCase();
                    console.log(`[AiService] Extracted Move: ${from} -> ${to}`);
                    return { from, to };
                }
            }

            // FALLBACK: Aggressive Search
            const aggressiveMatch = rawContent.match(/([a-h][1-8])\s*[- >toa]*\s*([a-h][1-8])/gi);
            if (aggressiveMatch && aggressiveMatch.length > 0) {
                for (let i = aggressiveMatch.length - 1; i >= 0; i--) {
                    const subMatch = aggressiveMatch[i].match(/([a-h][1-8])/gi);
                    if (subMatch && subMatch.length === 2) {
                        const from = subMatch[0].toLowerCase();
                        const to = subMatch[1].toLowerCase();
                        console.log(`[AiService] Aggressive match found: ${from} -> ${to}`);
                        return { from, to };
                    }
                }
            }

            throw new Error(`GROMIT ha fornito una risposta non valida o incompleta.`);

        } catch (error: any) {
            console.error('[AiService] CRITICAL ERROR IN CHESS MOVE:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
            if (error.response) {
                console.error('[AiService] API Response Error Data:', JSON.stringify(error.response, null, 2));
            }
            throw error;
        }
    }
}
