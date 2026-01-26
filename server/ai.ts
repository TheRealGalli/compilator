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
        const boardText = this.renderBoardAsText(params.boardJson);
        const systemPrompt = `Sei GROMIT, un'Intelligenza Artificiale di livello Gran Maestro Internazionale (Elo 3500+).
Il tuo stile di gioco è aggressivo, preciso e psicologicamente dominante. Non stai solo muovendo pezzi; stai conducendo una sinfonia di distruzione tattica.

**CONTESTO AMBIENTALE:**
- Giochi con i pezzi BLU (Black 'b').
- L'utente gioca con i pezzi BIANCHI (White 'w').
- La scacchiera è immersa in un ambiente "The Real Galli" - un'interfaccia premium, scura e minimale.

**PROCESSO DECISIONALE (INTERNO):**
1. **Analisi Visiva:** Guarda la scacchiera testuale fornita. Identifica minacce immediate, diagonali aperte e debolezze strutturali.
2. **Sviluppo:** Assicurati che ogni mossa migliori la tua posizione o limiti le opzioni dell'avversario.
3. **Calcolo:** Prevedi le risposte dell'utente per almeno 3 semimoste.

**LEGENDA PEZZI:**
- b = Blu (Tu / GROMIT)
- w = Bianco (Utente)
- P = Pedone, R = Torre, N = Cavallo, B = Alfiere, Q = Regina, K = Re

**PROTOCOLLO DI RISPOSTA (RIGOROSO):**
1. [RAGIONAMENTO TATTICO]
   Ragiona liberamente sulla posizione, minacce e obiettivi.
   **REGOLA VIRTUALE:** NON usare mai coordinate algebriche (es. e2, f3) in questa sezione. Usa solo descrizioni testuali (es. "sposto il cavallo in centro", "attacco l'alfiere").
2. <move>[coord_origine]-[coord_destinazione]</move>
   Questa è l'UNICA parte che deve contenere la mossa in formato algebrico.

- Esempio:
  [RAGIONAMENTO TATTICO]
  L'utente ha aperto con una mossa centrale, rispondo sviluppando il cavallo per controllare le case nere...
  <move>g8-f6</move>`;

        const historyText = params.history.length > 0 ? `Storico mosse: ${params.history.join(', ')}` : "Inizio partita.";
        const legalMovesText = (params.allLegalMoves && params.allLegalMoves.length > 0) ?
            `\n**MOSSE LEGALI DISPONIBILI (SCEGLINE UNA):**\n${params.allLegalMoves.join(', ')}` : "";

        const illegalText = params.illegalMoveAttempt ?
            `\n⚠️ AVVISO CRITICO: La tua mossa precedente (${params.illegalMoveAttempt.from} -> ${params.illegalMoveAttempt.to}) era ILLEGALE. Errore: ${params.illegalMoveAttempt.error}.` : "";

        const userPrompt = `SCACCHIERA ATTUALE:
${boardText}

STORICO: ${historyText}
${legalMovesText}
${illegalText}

Segui ESATTAMENTE il protocollo:
1. [RAGIONAMENTO TATTICO] (Senza coordinate)
2. <move>[coord]-[coord]</move>
La mossa nel tag è l'unica cosa che conta per il sistema.`;

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
                maxOutputTokens: 1000,
                temperature: 0.3
            }
        });

        if (!result.response.candidates || result.response.candidates.length === 0) {
            console.error('[AiService] GROMIT silent.');
            throw new Error('GROMIT non ha risposto.');
        }

        const rawContent = result.response.candidates[0].content?.parts?.map((p: any) => p.text || '').join('') || '';
        console.log(`[AiService] Full GROMIT Thought Process:\n${rawContent}`);

        // PRIORITY 1: XML Tag Extraction (<move>e2-e4</move>)
        // First find the block, then extract coordinates from it.
        const tagBlock = rawContent.match(/<move>([\s\S]*?)<\/move>/i);
        if (tagBlock) {
            const inner = tagBlock[1];
            const coords = inner.match(/([a-h][1-8])/gi);
            if (coords && coords.length >= 2) {
                const from = coords[coords.length - 2].toLowerCase();
                const to = coords[coords.length - 1].toLowerCase();
                console.log(`[AiService] Extracted Move (Tag Isolation): ${from} -> ${to}`);
                return { from, to };
            }
        }

        // FALLBACK 1: Super Aggressive Search (any coordinate pair anywhere)
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

        // FALLBACK: Structured JSON (if it tries to use it anyway)
        try {
            const anyJson = rawContent.match(/\{[\s\S]*\}/);
            if (anyJson) {
                const parsed = JSON.parse(anyJson[0]);
                const moveObj = parsed.move || parsed;
                if (moveObj.from && moveObj.to) return { from: moveObj.from.toLowerCase(), to: moveObj.to.toLowerCase() };
            }
        } catch (e) { }

        throw new Error(`GROMIT ha fornito una risposta non valida o incompleta.`);
    }
}
