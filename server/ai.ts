import { VertexAI, HarmCategory, HarmBlockThreshold } from '@google-cloud/vertexai';
import mammoth from 'mammoth';
import * as fs from 'fs';
import * as path from 'path';
import { DlpServiceClient } from '@google-cloud/dlp';

export class AiService {
    private vertex_ai: VertexAI;
    private projectId: string;
    private location: string;
    private modelId = 'gemini-2.5-flash';
    private dlpClient: DlpServiceClient;
    private ollamaUrl = 'http://localhost:11434/api/generate';
    private ollamaModel = 'gpt-oss:20b';

    constructor(projectId: string, location: string = 'europe-west1') {
        this.projectId = projectId;
        this.location = location;
        this.vertex_ai = new VertexAI({ project: projectId, location: location });
        this.dlpClient = new DlpServiceClient();

        console.log(`[AiService] Initialized with model: ${this.modelId} in ${location}`);
    }

    /**
     * Public helper to process multimodal files once and reuse across passes.
     */
    async processMultimodalParts(files: any[]): Promise<any[]> {
        const partsArrays = await Promise.all(files.map(async (file) => {
            const mimeType = file.mimeType || file.type || '';
            const base64Data = file.data || file.base64 || '';
            const fileNameLabel = file.name ? `[FILE: ${file.name}]` : '[FILE: Unknown]';

            if (!mimeType || !base64Data) return [];

            const isMultimodal =
                mimeType.startsWith('image/') ||
                mimeType === 'application/pdf' ||
                mimeType.startsWith('audio/') ||
                mimeType.startsWith('video/') ||
                mimeType === 'text/html' ||
                mimeType === 'text/markdown' ||
                mimeType === 'text/rtf' ||
                mimeType === 'application/rtf' ||
                mimeType === 'application/json' ||
                mimeType === 'application/xml' ||
                mimeType === 'text/xml' ||
                mimeType === 'application/vnd.oasis.opendocument.text';

            const isDOCX = mimeType.includes('wordprocessingml') || mimeType.includes('msword');

            if (isDOCX) {
                try {
                    console.log(`[AiService] Extracting text from DOCX file for Gemini pass...`);
                    const buffer = Buffer.from(base64Data, 'base64');
                    const { value: text } = await mammoth.extractRawText({ buffer });
                    return [
                        { text: fileNameLabel },
                        { text: `[CONTENUTO DOCUMENTO WORD]:\n${text}` }
                    ];
                } catch (err) {
                    console.error('[AiService] Error extracting DOCX text:', err);
                    return [];
                }
            } else if (isMultimodal) {
                return [
                    { text: fileNameLabel },
                    {
                        inlineData: {
                            mimeType: mimeType,
                            data: base64Data
                        }
                    }
                ];
            } else {
                // Fallback to text decoding for unknown/plain types
                try {
                    const text = Buffer.from(base64Data, 'base64').toString('utf-8');
                    return [
                        { text: fileNameLabel },
                        { text: `[CONTENUTO FILE ${mimeType}]:\n${text}` }
                    ];
                } catch (err) {
                    console.error('[AiService] Fallback text extraction failed:', err);
                    return [];
                }
            }
        }));

        // Flatten the array of arrays into a single array of parts
        return partsArrays.flat();
    }

    private italianBlacklist = new Set([
        'allora', 'dato', 'tuttavia', 'però', 'infatti', 'quindi', 'ossia', 'ovvero', 'ora',
        'purtroppo', 'sicuramente', 'probabilmente', 'chiaramente', 'ovviamente', 'anche',
        'perché', 'poiché', 'mentre', 'invece', 'oltretutto', 'inoltre'
    ]);

    /**
     * Professional PII Anonymization using Google Cloud DLP (Sensitive Data Protection).
     * Enhanced with smart merging and local deduplication.
     */
    async anonymizeWithDLP(text: string, vault: Map<string, string>): Promise<string> {
        if (!text || text.trim() === "") return text;

        try {
            console.log(`[AiService] Calling Cloud DLP for anonymization (Text length: ${text.length})...`);

            const [response] = await this.dlpClient.inspectContent({
                parent: `projects/${this.projectId}/locations/global`,
                item: { value: text },
                inspectConfig: {
                    infoTypes: [
                        { name: 'PERSON_NAME' },
                        { name: 'ORGANIZATION_NAME' },
                        { name: 'LOCATION' },
                        { name: 'EMAIL_ADDRESS' },
                        { name: 'PHONE_NUMBER' },
                        { name: 'ITALY_FISCAL_CODE' },
                        { name: 'VAT_NUMBER' },
                        { name: 'DATE_OF_BIRTH' }
                    ],
                    includeQuote: true,
                },
            });

            let findings = response.result?.findings || [];
            if (findings.length === 0) return text;

            // 1. SMART MERGING: Join fragmented entities (e.g. "Colle Val" + "d'Elsa")
            findings = this.smartMergeFindings(findings, text);

            // Sort findings by start offset descending to avoid index shifts during replacement
            const sortedFindings = [...findings].sort((a, b) => {
                const aOffset = Number(a.location?.byteRange?.start || 0);
                const bOffset = Number(b.location?.byteRange?.start || 0);
                return bOffset - aOffset;
            });

            const textBuffer = Buffer.from(text, 'utf-8');
            let lastByteOffset = textBuffer.length;
            const parts: Buffer[] = [];

            for (const finding of sortedFindings) {
                const start = Number(finding.location?.byteRange?.start || 0);
                const end = Number(finding.location?.byteRange?.end || 0);
                let value = (finding.quote || "").trim();
                const infoType = finding.infoType?.name;

                if (!value || !infoType) continue;

                // 2. BLACKLIST FILTER: Skip common Italian words misidentified as PII
                if (value.length < 15 && this.italianBlacklist.has(value.toLowerCase())) {
                    console.log(`[AiService] Skipping blacklisted finding: [REDACTED] (${infoType})`);
                    continue;
                }

                const typeKey = this.mapDlpTypeToInternal(infoType);

                // 3. SECURE DE-DUPLICATION: Check if this value already exists in the vault (case neutral)
                let token = "";
                const normalizedValue = value.toLowerCase().replace(/\s+/g, ' ');

                for (const [t, v] of vault.entries()) {
                    const normalizedExisting = v.toLowerCase().replace(/\s+/g, ' ');
                    if (normalizedExisting === normalizedValue && t.includes(typeKey)) {
                        token = t;
                        break;
                    }
                }

                if (!token) {
                    let count = 0;
                    for (const t of vault.keys()) {
                        if (t.startsWith(`[${typeKey}_`)) count++;
                    }
                    token = `[${typeKey}_${count + 1}]`;
                    vault.set(token, value);
                    console.log(`[AiService] Created new token: ${token} -> [REDACTED]`);
                }

                // Add text after the finding
                if (lastByteOffset > end) {
                    parts.unshift(textBuffer.subarray(end, lastByteOffset));
                }
                // Add the token
                parts.unshift(Buffer.from(token, 'utf-8'));
                lastByteOffset = start;
            }

            // Add text before the first finding
            if (lastByteOffset > 0) {
                parts.unshift(textBuffer.subarray(0, lastByteOffset));
            }

            return Buffer.concat(parts).toString('utf-8');
        } catch (error) {
            console.error('[AiService] DLP Anonymization Error:', error);
            return text;
        }
    }

    /**
     * Professional PII Anonymization using Local Ollama (e.g. GPT-OSS 20B).
     * This ensures 100% data privacy (Zero-Data) as no data leaves localhost.
     * Uses a refined prompt to ensure high recall and precise tagging.
     */
    async anonymizeWithOllama(text: string, vault: Map<string, string>): Promise<string> {
        if (!text || text.trim() === "") return text;

        try {
            console.log(`[AiService] Calling Local Ollama for PII Extraction (Text length: ${text.length})...`);

            const systemPrompt = `[INST] Sei un Agente di Estrazione Dati. Identifica TUTTI i dati sensibili.
Categorie: NOME_PERSONA, ORGANIZZAZIONE, INDIRIZZO, EMAIL, TELEFONO, CODICE_FISCALE, PARTITA_IVA.

ESEMPIO 1:
TESTO: Mi chiamo Mario Rossi e lavoro per XYZ Corp. Mail: mario@xyz.it
JSON: {"findings": [{"value": "Mario Rossi", "category": "NOME_PERSONA"}, {"value": "XYZ Corp", "category": "ORGANIZZAZIONE"}, {"value": "mario@xyz.it", "category": "EMAIL"}]}

ESEMPIO 2:
TESTO: L'ufficio è in Via Roma 10, Milano. Tel: 02 1234567. P.IVA 12345678901.
JSON: {"findings": [{"value": "Via Roma 10, Milano", "category": "INDIRIZZO"}, {"value": "02 1234567", "category": "TELEFONO"}, {"value": "12345678901", "category": "PARTITA_IVA"}]}

REGOLE:
- Copia il valore ESATTAMENTE come nel testo.
- Includi i nomi completi.
- Restituisci SOLO il JSON.

TESTO:
${text} [/INST]`;

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

            const response = await fetch(this.ollamaUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.ollamaModel,
                    prompt: systemPrompt,
                    format: 'json',
                    stream: false,
                    options: {
                        temperature: 0.1,
                        num_ctx: 32768,
                        keep_alive: -1,
                    }
                }),
                signal: controller.signal
            }).finally(() => clearTimeout(timeoutId));

            if (!response.ok) {
                console.warn(`[AiService] Ollama unreachable on port 11434.`);
                return text;
            }

            const data = await response.json() as any;
            let rawResponse = data.response || "";

            if (!rawResponse || rawResponse.trim() === "") {
                console.warn("[AiService] Ollama returned empty response.");
                return text;
            }

            let findings: any[] = [];
            try {
                // Try to parse the JSON response
                const parsed = JSON.parse(rawResponse);
                findings = parsed.findings || [];
            } catch (e) {
                console.error("[AiService] FAILED to parse Ollama JSON.");
                // Simple regex fallback if JSON parsing fails
                const regex = /"value":\s*"([^"]+)",\s*"category":\s*"([^"]+)"/g;
                let match;
                while ((match = regex.exec(rawResponse)) !== null) {
                    findings.push({ value: match[1], category: match[2] });
                }
            }

            if (findings.length === 0) {
                console.log(`[AiService] Ollama found no PII.`);
                return text;
            }

            // --- CODE-ASSISTED REPLACEMENT & VAULTING ---
            let anonymizedText = text;

            // Sort findings by length descending to replace "Mario Rossi" before "Mario"
            const sortedFindings = findings.sort((a, b) => (b.value.length - a.value.length));

            for (const finding of sortedFindings) {
                const value = finding.value.trim();
                const category = finding.category.toUpperCase().replace(/\s+/g, '_');

                if (!value || value.length < 2) continue;

                // SECURE DE-DUPLICATION: Check if this value already exists in the vault (case neutral)
                let token = "";
                const normalizedValue = value.toLowerCase();

                for (const [t, v] of vault.entries()) {
                    if (v.toLowerCase() === normalizedValue && t.includes(category)) {
                        token = t;
                        break;
                    }
                }

                if (!token) {
                    // Calculate next sequential number for this category
                    let count = 0;
                    for (const t of vault.keys()) {
                        if (t.startsWith(`[${category}_`)) count++;
                    }
                    token = `[${category}_${count + 1}]`;
                    vault.set(token, value);
                    console.log(`[AiService] New vault entry (Ollama + Code): ${token} -> [REDACTED]`);
                }

                // Global replacement of the value with the token
                // Using regex for word boundaries if it's text, but carefully
                try {
                    const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    anonymizedText = anonymizedText.replace(new RegExp(escapedValue, 'g'), token);
                } catch (err) {
                    anonymizedText = anonymizedText.split(value).join(token);
                }
            }

            console.log(`[AiService] Code-Assisted Anonymization successful. Vault Size: ${vault.size}`);
            return anonymizedText;

        } catch (error) {
            console.error('[AiService] Ollama Anonymization Error:', error);
            return text;
        }
    }

    /**
     * Join adjacent or very close findings of same or compatible types to reduce fragmentation.
     */
    private smartMergeFindings(findings: any[], text: string): any[] {
        if (findings.length <= 1) return findings;

        // Sort ASCENDING for merging
        const sorted = [...findings].sort((a, b) => {
            const aStart = Number(a.location?.byteRange?.start || 0);
            const bStart = Number(b.location?.byteRange?.start || 0);
            return aStart - bStart;
        });

        const merged: any[] = [];
        let current = sorted[0];
        const textBuffer = Buffer.from(text, 'utf-8');

        for (let i = 1; i < sorted.length; i++) {
            const next = sorted[i];
            const currentEnd = Number(current.location?.byteRange?.end || 0);
            const nextStart = Number(next.location?.byteRange?.start || 0);

            const gap = nextStart - currentEnd;
            const sameType = current.infoType?.name === next.infoType?.name;
            const compatibleType = (
                (current.infoType?.name === 'LOCATION' || current.infoType?.name === 'PERSON_NAME' || current.infoType?.name === 'ORGANIZATION_NAME') &&
                (next.infoType?.name === 'LOCATION' || next.infoType?.name === 'PERSON_NAME' || next.infoType?.name === 'ORGANIZATION_NAME')
            );

            // Check if characters in between are just "soft" characters (spaces, punctuation, etc.)
            const gapText = textBuffer.subarray(currentEnd, nextStart).toString('utf-8');
            const isSoftGap = gapText === "" || /^[\s,.\-\/()&'’]+$/.test(gapText);

            // Allow merging if gap is small and consists of punctuation/spaces
            if (gap <= 8 && isSoftGap && compatibleType) {
                const newEnd = Number(next.location?.byteRange?.end || 0);
                const combinedQuote = textBuffer.subarray(Number(current.location?.byteRange?.start || 0), newEnd).toString('utf-8');

                // Keep the "best" infoType (prefer LOCATION or ORG over PERSON for mixed merge if it looks like an address)
                let bestType = current.infoType;
                if (current.infoType?.name === 'PERSON_NAME' && (next.infoType?.name === 'LOCATION' || next.infoType?.name === 'ORGANIZATION_NAME')) {
                    bestType = next.infoType;
                }

                current = {
                    ...current,
                    quote: combinedQuote,
                    infoType: bestType,
                    location: {
                        ...current.location,
                        byteRange: {
                            ...current.location.byteRange,
                            end: newEnd
                        }
                    }
                };
            } else {
                merged.push(current);
                current = next;
            }
        }
        merged.push(current);
        return merged;
    }

    private mapDlpTypeToInternal(dlpType: string): string {
        const mapping: Record<string, string> = {
            'PERSON_NAME': 'NOME_PERSONA',
            'ORGANIZATION_NAME': 'ORGANIZZAZIONE',
            'LOCATION': 'INDIRIZZO',
            'EMAIL_ADDRESS': 'EMAIL',
            'PHONE_NUMBER': 'TELEFONO',
            'ITALY_FISCAL_CODE': 'CODICE_FISCALE',
            'VAT_NUMBER': 'PARTITA_IVA',
            'DATE_OF_BIRTH': 'DATA_NASCITA'
        };
        return mapping[dlpType] || dlpType;
    }

    async compileDocument(params: {
        systemPrompt: string,
        userPrompt: string,
        multimodalFiles: any[],
        masterSource?: any,
        preProcessedParts?: any[],
        preProcessedMasterParts?: any[],
        webResearch?: boolean
    }): Promise<{ content: string, groundingMetadata?: any, parts?: any[], aiMetadata?: { codeExecutionResults?: Array<{ code: string, output: string }> } }> {
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
                params.preProcessedMasterParts ? Promise.resolve(params.preProcessedMasterParts) :
                    ((params.masterSource && params.masterSource.base64) ? this.processMultimodalParts([params.masterSource]) : Promise.resolve([]))
            ]);

            const messageParts: any[] = [{ text: params.userPrompt }, ...multimodalParts, ...masterParts];

            const tools: any[] = params.webResearch ? [{ googleSearch: {} }] : [];

            // Add toolConfig to explicitly allow/force tool use if appropriate
            const toolConfig: any = tools.length > 0 ? {
                functionCallingConfig: {
                    mode: 'AUTO',
                }
            } : undefined;

            // VERTEX AI CONSTRAINT: codeExecution CANNOT coexist with ANY other tool.
            // When tools (googleSearch or functions) are present, skip codeExecution.
            // ThinkingMode still handles reasoning improvement.
            const finalTools = tools.length > 0 ? tools : [{ codeExecution: {} }];

            const result = await model.generateContent({
                contents: [{ role: 'user', parts: messageParts }],
                tools: finalTools,
                toolConfig,
                generationConfig: {
                    maxOutputTokens: 50000,
                    temperature: 0.2,
                    // @ts-ignore - thinkingConfig is part of the 2026 Vertex AI SDK
                    thinkingConfig: {
                        includeThoughts: false, // Thoughts are internal to the model
                        thinkingBudget: 4000     // 4k tokens budget for the compiler
                    }
                }
            });

            const candidate = result.response.candidates?.[0];
            const content = candidate?.content?.parts?.map((p: any) => p.text || '').join('') || '';
            const groundingMetadata = candidate?.groundingMetadata;

            if (params.webResearch) {
                console.log(`[AiService] Grounding Metadata returned:`, groundingMetadata ? 'YES' : 'NONE');
                if (groundingMetadata?.searchEntryPoint) {
                    console.log(`[AiService] Search Entry Point detected.`);
                }
            }

            // Extract code execution metadata from response parts
            const codeExecutionResults: Array<{ code: string, output: string }> = [];
            const allParts = (candidate?.content?.parts || []) as any[];
            for (let i = 0; i < allParts.length; i++) {
                const part = allParts[i];
                if (part.executableCode) {
                    const nextPart = allParts[i + 1];
                    codeExecutionResults.push({
                        code: part.executableCode.code || '',
                        output: nextPart?.codeExecutionResult?.output || ''
                    });
                }
            }

            if (codeExecutionResults.length > 0) {
                console.log(`[AiService] Code Execution detected: ${codeExecutionResults.length} block(s)`);
            }

            const aiMetadata = codeExecutionResults.length > 0 ? { codeExecutionResults } : undefined;

            return { content, groundingMetadata, parts: multimodalParts, aiMetadata };

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

4. **ANTI-LOOP PROTOCOL**: 
   - È vietato generare più di 15 caratteri identici consecutivi (es. "---").
   - In caso di loop generativo, scrivi "LOOP_DETECTED" e interrompi.

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
                    temperature: 0.1,
                    // @ts-ignore
                    thinkingConfig: {
                        includeThoughts: false,
                        thinkingBudget: 2000 // Lower budget for formatting refactor
                    }
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
            console.log(`[AiService] Full Response received (Length: ${rawContent.length})`);

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
