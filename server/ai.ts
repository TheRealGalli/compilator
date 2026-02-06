import { VertexAI, HarmCategory, HarmBlockThreshold } from '@google-cloud/vertexai';
import mammoth from 'mammoth';
import * as fs from 'fs';
import * as path from 'path';

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

    async compileDocument(params: {
        systemPrompt: string,
        userPrompt: string,
        multimodalFiles: any[],
        masterSource?: any,
        preProcessedParts?: any[],
        webResearch?: boolean
    }): Promise<{ content: string, groundingMetadata?: any, parts?: any[] }> {
        try {
            const model = this.vertex_ai.getGenerativeModel({
                model: this.modelId,
                systemInstruction: {
                    role: 'system',
                    parts: [{ text: params.systemPrompt }]
                }
            });

            // Use pre-processed parts if provided to save latency
            const [multimodalParts, masterParts] = await Promise.all([
                params.preProcessedParts ? Promise.resolve(params.preProcessedParts) : this.processMultimodalParts(params.multimodalFiles),
                (params.masterSource && params.masterSource.base64) ? this.processMultimodalParts([params.masterSource]) : Promise.resolve([])
            ]);

            const messageParts: any[] = [{ text: params.userPrompt }, ...multimodalParts, ...masterParts];

            const tools: any[] = params.webResearch ? [{ googleSearch: {} }] : [];

            const result = await model.generateContent({
                contents: [{ role: 'user', parts: messageParts }],
                tools,
                generationConfig: {
                    maxOutputTokens: 50000,
                    temperature: 0.2
                }
            });

            const candidate = result.response.candidates?.[0];
            const content = candidate?.content?.parts?.map((p: any) => p.text || '').join('') || '';
            const groundingMetadata = candidate?.groundingMetadata;

            return { content, groundingMetadata, parts: multimodalParts };

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

    private getAttackersForSquare(targetCoord: string, attackerColor: 'w' | 'b', boardJson: any): string[] {
        const attackers: string[] = [];
        const to = this.fromAlgebraic(targetCoord);
        for (const [coord, piece] of Object.entries(boardJson)) {
            if (piece === "empty" || !piece) continue;
            if (typeof piece === 'string' && piece.startsWith(attackerColor)) {
                const from = this.fromAlgebraic(coord);
                if (this.canPieceAttack(piece, from, to, boardJson)) attackers.push(piece);
            }
        }
        return attackers;
    }

    private fromAlgebraic(coord: string) {
        const c = coord.charCodeAt(0) - 97;
        const r = 8 - parseInt(coord[1]);
        return { r, c };
    }

    private canPieceAttack(piece: string, from: { r: number, c: number }, to: { r: number, c: number }, board: any): boolean {
        if (from.r === to.r && from.c === to.c) return false;
        const type = piece.substring(1);
        const dr = to.r - from.r;
        const dc = to.c - from.c;
        const absDr = Math.abs(dr);
        const absDc = Math.abs(dc);
        switch (type) {
            case 'P':
                const direction = piece.startsWith('w') ? -1 : 1;
                return dr === direction && absDc === 1;
            case 'N':
                return (absDr === 2 && absDc === 1) || (absDr === 1 && absDc === 2);
            case 'R':
                if (from.r !== to.r && from.c !== to.c) return false;
                return !this.isLineBlocked(from, to, board);
            case 'B':
                if (absDr !== absDc) return false;
                return !this.isLineBlocked(from, to, board);
            case 'Q':
                if (from.r !== to.r && from.c !== to.c && absDr !== absDc) return false;
                return !this.isLineBlocked(from, to, board);
            case 'K':
                return absDr <= 1 && absDc <= 1;
        }
        return false;
    }

    private isLineBlocked(from: { r: number, c: number }, to: { r: number, c: number }, board: any): boolean {
        const dr = Math.sign(to.r - from.r);
        const dc = Math.sign(to.c - from.c);
        let r = from.r + dr;
        let c = from.c + dc;
        while (r !== to.r || c !== to.c) {
            const file = String.fromCharCode(97 + c);
            const rank = 8 - r;
            const coord = `${file}${rank}`;
            if (board[coord] && board[coord] !== "empty") return true;
            r += dr;
            c += dc;
        }
        return false;
    }

    /**
     * Specialized method for Chess AI moves using Gemini 2.5 Flash.
     */
    async getChessMove(params: {
        boardJson: any,
        history: string[],
        illegalMoveAttempt?: { from: string, to: string, error: string, validMoves: string[] },
        allLegalMoves?: string[],
        capturedWhite?: string[],
        capturedBlack?: string[],
        thoughtHistory?: string[],
        capturedPieces?: any[] // Optional legacy field
    }, retryCount = 0): Promise<{ from: string, to: string, thought: string }> {
        try {
            const boardText = this.renderBoardAsText(params.boardJson);
            const legalMoves = params.allLegalMoves || [];

            // 📖 CARICAMENTO DEL COMPENDIO DEL MAESTRO (Reference Manual)
            let tutorialContent = "";
            try {
                const memoryPath = path.join(process.cwd(), 'GromitChess-Memory.md');
                if (fs.existsSync(memoryPath)) {
                    tutorialContent = fs.readFileSync(memoryPath, 'utf8');
                }
            } catch (err) {
                console.error("[AiService] Failed to load GromitChess-Memory.md:", err);
            }

            // SYSTEM PROMPT: Persistent Reference Manual
            const systemPrompt = `Sei GROMIT, un Grande Maestro di scacchi e "Chess Coach". Giochi con il BLU (b).

${tutorialContent ? `### 📖 MANUALE DEL MAESTRO (DA CONSULTARE SEMPRE):
${tutorialContent}` : "Segui le regole standard degli scacchi e i tuoi principi strategici."}

### [PROTOCOLLO DI RISPOSTA]
⚠️ **MOLTO IMPORTANTE**: Prima di scrivere qualsiasi cosa, analizza mentalmente la SCACCHIERA, consulta il MANUALE DEL MAESTRO e valuta con estrema attenzione gli ALERT TATTICI e di DIFESA. Solo dopo procedi con:
1. <move>origine-destinazione</move> (es. <move>e7-e5</move>).
2. <thought>analisi strategica coincisa ma completa che spieghi PERCHÉ hai scelto quella mossa basandoti sui dati sopra, sui rischi evidenziati, sulla difesa dei tuoi pezzi e sulla tua strategia a lungo termine.</thought>

### ⚠️ MESSAGGIO IMPORTANTE DA MAESTRO GALLO
"Gromit, ascoltami bene:
1. **APERTURA**: Sviluppa TUTTI i tuoi pezzi. Non lasciare pezzi pigri nelle case iniziali.
2. **COORDINAZIONE**: Fai molta attenzione ad Alfieri e Regina dopo aver mosso i Cavalli. Devono avere spazio per agire.
3. **RISPETTO DEL MATERIALE**: NON regalare mai pezzi all'avversario. Ogni mossa deve essere sicura. Se il nemico ti tende una trappola, non caderci.
4. **ATTENZIONE TATTICA**: Non allucinare movimenti in posizioni sotto attacco. È molto meglio muoversi una casella in meno piuttosto che atterrare nella diagonale pulita di un Alfiere nemico o sotto il tiro di un pezzo avversario.
5. **DIFESA**: Riconosci subito quando i tuoi pezzi sono già sotto attacco e valuta se è il momento di spostarli o difenderli meglio.

Gromit, ricordati anche di divertirti! Buona fortuna."

### [GUIDE TATTICHE GROMIT]
- **ORDINE**: Scrivi SEMPRE la mossa prima del pensiero, ma pensa PRIMA di scrivere.
- **SICUREZZA RE**: L'Arrocco è una tua priorità assoluta nei primi 10-15 tratti. Se vedi un ALERT per l'ARROCCO, eseguilo quasi sempre.
- **AGGRESSIVITÀ**: Se vedi un ALERT per una CATTURA, valuta se il pezzo è difeso (guarda i rischi nell'alert). Se è sicuro o il cambio ti favorisce, MANGIALO.
- **DIFESA ATTIVA**: Se un tuo pezzo è segnalato come SOTTO ATTACCCO, valuta la mossa migliore per salvarlo o contrattaccare.
- **VISTA TATTICA**: Gli ALERT TATTICI sono suggerimenti precisi del tuo secondo basati sulla fisica del campo; usali come guida primaria."
`;

            const historyText = params.history.length > 0 ? `Storico Partita: ${params.history.join(', ')}` : "Inizio partita.";
            const legalMovesText = legalMoves.length > 0 ?
                `\nMOSSE LEGALI PER TE (b): ${legalMoves.join(', ')}` : "";
            const illegalText = params.illegalMoveAttempt ? `\n❌ ERRORE PRECEDENTE: ${params.illegalMoveAttempt.from}-${params.illegalMoveAttempt.to} era ILLEGALE.
⚠️ ATTENZIONE: Hai violato la fisica del pezzo o le regole di scacco. 
👉 RI-CONSULTA IL "MANUALE DEL MAESTRO" SOPRA, analizza le mappe visive dei movimenti e riprova.` : "";

            const capturedWhiteText = params.capturedWhite && params.capturedWhite.length > 0 ? `BIANCHE MANGIATE: ${params.capturedWhite.join(', ')}` : "Nessuna pedina bianca mangiata.";
            const capturedBlackText = params.capturedBlack && params.capturedBlack.length > 0 ? `BLU (TUE) MANGIATE: ${params.capturedBlack.join(', ')}` : "Nessuna tua pedina mangiata.";

            // 🎯 RILEVAMENTO TATTICO: Catture, Rischi e Arrocco
            const tacticalAlerts: string[] = [];
            legalMoves.forEach(m => {
                const parts = m.split('-');
                if (parts.length === 2) {
                    const to = parts[1];
                    const targetPiece = params.boardJson[to];

                    if (targetPiece && targetPiece !== "empty" && targetPiece.startsWith('w')) {
                        let alert = `PUOI MANGIARE ${targetPiece.toUpperCase()} in ${to} con la mossa ${m}`;
                        const defenders = this.getAttackersForSquare(to, 'w', params.boardJson);
                        if (defenders.length > 0) {
                            alert += ` ⚠️ (ATTENZIONE: ${to} è difesa da: ${defenders.join(', ')})`;
                        } else {
                            alert += ` ✅ (CATTURA SICURA: il pezzo non sembra difeso)`;
                        }
                        tacticalAlerts.push(alert);
                    }

                    if (m === "e8-g8") tacticalAlerts.push(`PUOI FARE ARROCCO CORTO (O-O) per mettere al sicuro il Re!`);
                    if (m === "e8-c8") tacticalAlerts.push(`PUOI FARE ARROCCO LUNGO (O-O-O) per mettere al sicuro il Re!`);
                }
            });

            const tacticalAlertsText = tacticalAlerts.length > 0 ?
                `\n⚠️ ALERT TATTICI (PRIORITÀ ALTA):\n${tacticalAlerts.join('\n')}\n` : "";

            // 🛡️ ALERT DI DIFESA: Pezzi di GROMIT attualmente sotto attacco
            const defenseAlerts: string[] = [];
            for (const [coord, piece] of Object.entries(params.boardJson)) {
                if (piece && typeof piece === 'string' && piece.startsWith('b')) {
                    const attackers = this.getAttackersForSquare(coord, 'w', params.boardJson);
                    if (attackers.length > 0) {
                        defenseAlerts.push(`⚠️ IL TUO PEZZO ${piece.toUpperCase()} in ${coord} è SOTTO ATTACCO da: ${attackers.join(', ')}`);
                    }
                }
            }
            const defenseAlertsText = defenseAlerts.length > 0 ?
                `\n🛡️ ALERT DI DIFESA (ATTENZIONE):\n${defenseAlerts.join('\n')}\n` : "";

            const thoughtHistoryText = (params.thoughtHistory && params.thoughtHistory.length > 0) ?
                `\nSTORICO RAGIONAMENTI (Pensieri delle tue MOSSE PRECEDENTI - NON di quella attuale):\n${params.thoughtHistory.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n` : "";

            const userPrompt = `SCACCHIERA:\n${boardText}\n\n${historyText}${legalMovesText}${illegalText}${tacticalAlertsText}${defenseAlertsText}${thoughtHistoryText}\n\nMATERIALE:\n${capturedWhiteText}\n${capturedBlackText}\n\nMossa per b:`;

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
                    maxOutputTokens: 2000,
                    temperature: 0.1
                }
            });

            const candidate = result.response.candidates?.[0];
            const rawContent = candidate?.content?.parts?.map((p: any) => p.text || '').join('') || '';
            console.log(`[AiService] Full Response:\n${rawContent}`);

            // 1. EXTRACT THOUGHTS (Handling potential truncation)
            let thought = "Nessun ragionamento fornito.";
            const thoughtMatch = rawContent.match(/<thought>([\s\S]*?)(?:<\/thought>|$)/i);
            if (thoughtMatch) {
                thought = thoughtMatch[1].trim();
            }

            // 2. EXTRACT MOVE
            const moveTagMatch = rawContent.match(/<move>\s*([a-h][1-8])\s*[- >toa]*\s*([a-h][1-8])\s*<\/move>/i);

            if (moveTagMatch) {
                const move = { from: moveTagMatch[1].toLowerCase(), to: moveTagMatch[2].toLowerCase() };
                console.log(`[AiService] Extracted: ${move.from}-${move.to}`);
                return { from: move.from, to: move.to, thought };
            }

            // 3. BACKUP EXTRACTION (Only if tag is missing but coords are there, outside thought)
            const remainingContent = rawContent.replace(/<thought>[\s\S]*?<\/thought>/i, '');
            const coords = remainingContent.match(/([a-h][1-8])\s*[- >toa]*\s*([a-h][1-8])/gi);
            if (coords && coords.length > 0) {
                const parts = coords[0].match(/([a-h][1-8])/gi);
                if (parts && parts.length === 2) {
                    return { from: parts[0].toLowerCase(), to: parts[1].toLowerCase(), thought };
                }
            }

            throw new Error(`GROMIT non ha fornito una mossa chiara: "${rawContent.substring(0, 100)}..."`);

        } catch (error: any) {
            console.error('[AiService] Chess Error:', error);
            throw error;
        }
    }
}
