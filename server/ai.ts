import { VertexAI } from '@google-cloud/vertexai';
import { DocumentProcessorServiceClient } from '@google-cloud/documentai';

export class AiService {
    private vertex_ai: VertexAI;
    private documentAiClient: DocumentProcessorServiceClient;
    private projectId: string;
    private location: string;
    private modelId = 'gemini-2.5-flash';

    constructor(projectId: string, location: string = 'europe-west1') {
        this.projectId = projectId;
        this.location = location;
        this.vertex_ai = new VertexAI({ project: projectId, location });

        // Document AI client with correct regional endpoint
        const docAiLocation = process.env.DOCUMENT_AI_LOCATION || 'eu';
        this.documentAiClient = new DocumentProcessorServiceClient({
            apiEndpoint: `${docAiLocation}-documentai.googleapis.com`
        });

        console.log(`[AiService] Initialized with model: ${this.modelId} in ${location}`);
    }

    /**
     * Describes the PDF layout using Vision capabilities.
     * Returns a list of semantic fields with normalized coordinates.
     */
    async analyzeLayout(base64Pdf: string): Promise<any[]> {
        try {
            const model = this.vertex_ai.getGenerativeModel({
                model: this.modelId,
                generationConfig: { responseMimeType: "application/json" }
            });

            const prompt = `
      Agisci come un motore di analisi layout per documenti con PRECISIONE PIXEL-PERFECT.
      
      COMPITO:
      1. ANALIZZA attentamente il documento PDF allegato
      2. RILEVA tutti i campi vuoti dove dovrebbero essere inseriti dati:
         - Underscore (_____), linee vuote, caselle, spazi bianchi evidenti
         - Righe per firma, campi numerici, date
      3. Per ogni campo, CALCOLA la posizione esatta del PRIMO CARATTERE dove inizierebbe il testo
      
      OUTPUT RICHIESTO per ogni campo:
      - "name": Etichetta semantica SPECIFICA in ITALIANO (es. "Cognome", "Data di Nascita", "Codice Fiscale")
      - "box_2d": Bounding box PRECISO come [ymin, xmin, ymax, xmax] su scala 0-1000
      - "charStart": Posizione X del primo carattere (scala 0-1000) - dove inizia effettivamente lo spazio scrivibile
      - "baseline": Posizione Y della linea base del testo (scala 0-1000)
      - "estimatedFont": Font stimato (es. "Helvetica", "Times", "Arial")
      - "estimatedSize": Dimensione font stimata in pt (es. 10, 11, 12)

      ATTENZIONE: 
      - Le coordinate devono essere PRECISE al pixel
      - charStart deve indicare dove INIZIA lo spazio scrivibile, non l'etichetta
      - Usa la linea base (baseline) per allineamento verticale preciso

      Restituisci JSON: { "data": [ { "name": "...", "box_2d": [0,0,0,0], "charStart": 0, "baseline": 0, "estimatedFont": "...", "estimatedSize": 11 } ] }
      `;

            const result = await model.generateContent({
                contents: [
                    {
                        role: 'user',
                        parts: [
                            { text: prompt },
                            { inlineData: { mimeType: 'application/pdf', data: base64Pdf } }
                        ]
                    }
                ]
            });

            const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
            const json = JSON.parse(responseText.replace(/```json|```/g, '').trim());

            if (!json.data || !Array.isArray(json.data)) return [];

            return json.data.map((item: any) => {
                const [ymin, xmin, ymax, xmax] = item.box_2d || [0, 0, 0, 0];
                return {
                    name: item.name,
                    boundingPoly: {
                        normalizedVertices: [
                            { x: xmin / 1000, y: ymin / 1000 },
                            { x: xmax / 1000, y: ymin / 1000 },
                            { x: xmax / 1000, y: ymax / 1000 },
                            { x: xmin / 1000, y: ymax / 1000 }
                        ]
                    },
                    // New precision fields
                    charStart: item.charStart ? item.charStart / 1000 : xmin / 1000,
                    baseline: item.baseline ? item.baseline / 1000 : ymax / 1000,
                    estimatedFont: item.estimatedFont || 'Helvetica',
                    estimatedSize: item.estimatedSize || 11,
                    pageIndex: 0,
                    source: 'gemini_vision_precise'
                };
            });

        } catch (error) {
            console.error('[AiService] analyzeLayout error:', error);
            return [];
        }
    }

    /**
     * Analyze PDF using Google Cloud Document AI Form Parser
     * Returns precise field positions extracted from PDF structure
     * MUCH FASTER than Vision-based analysis (2-5s vs 20-30s)
     */
    async analyzeLayoutWithDocumentAI(base64Pdf: string, processorId?: string): Promise<any[]> {
        try {
            const startTime = Date.now();
            console.log('[AiService] analyzeLayoutWithDocumentAI: Starting...');

            // Use environment variable or default processor ID
            const formParserProcessorId = processorId || process.env.DOCUMENT_AI_PROCESSOR_ID;

            if (!formParserProcessorId) {
                console.warn('[AiService] No Document AI processor ID configured, falling back to Vision');
                return this.analyzeLayout(base64Pdf);
            }

            // Document AI processor location - can be different from Vertex AI location
            const docAiLocation = process.env.DOCUMENT_AI_LOCATION || 'eu';
            const processorName = `projects/${this.projectId}/locations/${docAiLocation}/processors/${formParserProcessorId}`;

            console.log(`[AiService] Using processor: ${processorName}`);

            // Convert base64 to Buffer (Document AI needs binary content)
            const contentBuffer = Buffer.from(base64Pdf, 'base64');

            const request = {
                name: processorName,
                rawDocument: {
                    content: contentBuffer,
                    mimeType: 'application/pdf'
                }
            };

            const [result] = await this.documentAiClient.processDocument(request);
            const document = result.document;

            if (!document) {
                console.warn('[AiService] Document AI returned no document');
                return [];
            }

            const fields: any[] = [];

            // Extract form fields from Document AI response
            if (document.pages) {
                for (let pageIndex = 0; pageIndex < document.pages.length; pageIndex++) {
                    const page = document.pages[pageIndex];

                    // Extract form fields
                    if (page.formFields) {
                        for (const formField of page.formFields) {
                            const textAnchorName = formField.fieldName?.textAnchor;
                            const textAnchorValue = formField.fieldValue?.textAnchor;

                            let fieldName = 'Campo';
                            if (textAnchorName && textAnchorName.textSegments && document.text) {
                                fieldName = textAnchorName.textSegments
                                    .map((seg: any) => document.text!.substring(Number(seg.startIndex || 0), Number(seg.endIndex || 0)))
                                    .join('');
                            }

                            let fieldValue = '';
                            if (textAnchorValue && textAnchorValue.textSegments && document.text) {
                                fieldValue = textAnchorValue.textSegments
                                    .map((seg: any) => document.text!.substring(Number(seg.startIndex || 0), Number(seg.endIndex || 0)))
                                    .join('');
                            }

                            const boundingBox = formField.fieldName?.boundingPoly || formField.fieldValue?.boundingPoly;

                            if (boundingBox?.normalizedVertices) {
                                const vertices = boundingBox.normalizedVertices;
                                fields.push({
                                    name: fieldName.trim().replace(/[:\s]+$/, ''),
                                    value: fieldValue.trim(),
                                    boundingPoly: {
                                        normalizedVertices: vertices.map((v: any) => ({
                                            x: v.x || 0,
                                            y: v.y || 0
                                        }))
                                    },
                                    pageIndex: pageIndex,
                                    source: 'document_ai_form_parser'
                                });
                            }
                        }
                    }

                    // Fallback: If no structured form fields found on this page, use text segments (lines) as potential candidates
                    if (fields.filter(f => f.pageIndex === pageIndex).length === 0 && page.lines) {
                        for (const line of page.lines) {
                            const textAnchor = line.layout?.textAnchor;
                            let content = '';
                            if (textAnchor && textAnchor.textSegments && document.text) {
                                content = textAnchor.textSegments
                                    .map((seg: any) => document.text!.substring(Number(seg.startIndex || 0), Number(seg.endIndex || 0)))
                                    .join('');
                            }

                            if (content.trim().length > 2 && content.trim().length < 60) {
                                const vertices = line.layout?.boundingPoly?.normalizedVertices;
                                if (vertices && vertices.length >= 4) {
                                    fields.push({
                                        name: content.trim().replace(/[:\s_.-]+$/, ''),
                                        value: '',
                                        boundingPoly: {
                                            normalizedVertices: vertices.map((v: any) => ({
                                                x: v.x || 0,
                                                y: v.y || 0
                                            }))
                                        },
                                        pageIndex: pageIndex,
                                        source: 'document_ai_layout_line'
                                    });
                                }
                            }
                        }
                    }

                    // Also extract tables if present
                    if (page.tables) {
                        for (const table of page.tables) {
                            if (table.headerRows) {
                                for (const row of table.headerRows) {
                                    if (row.cells) {
                                        for (const cell of row.cells) {
                                            const text = cell.layout?.textAnchor?.content || '';
                                            const bp = cell.layout?.boundingPoly;
                                            if (bp?.normalizedVertices && text.trim()) {
                                                fields.push({
                                                    name: text.trim(),
                                                    boundingPoly: {
                                                        normalizedVertices: bp.normalizedVertices.map((v: any) => ({
                                                            x: v.x || 0,
                                                            y: v.y || 0
                                                        }))
                                                    },
                                                    pageIndex: pageIndex,
                                                    source: 'document_ai_table'
                                                });
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            const elapsed = Date.now() - startTime;
            console.log(`[AiService] analyzeLayoutWithDocumentAI: Found ${fields.length} fields in ${elapsed}ms`);

            return fields;

        } catch (error: any) {
            console.error('[AiService] analyzeLayoutWithDocumentAI error:', error?.message || error);
            // Fallback to Vision-based analysis
            console.log('[AiService] Falling back to Vision-based analysis');
            return this.analyzeLayout(base64Pdf);
        }
    }

    /**
     * Compiles the document using strict context from sources.
     */
    async compileDocument(params: {
        systemPrompt: string,
        userPrompt: string,
        multimodalFiles: any[], // { mimeType, data }
        pinnedSource?: { type: string, base64: string }
    }): Promise<string> {
        try {
            const model = this.vertex_ai.getGenerativeModel({
                model: this.modelId,
                systemInstruction: {
                    role: 'system',
                    parts: [{ text: params.systemPrompt }]
                }
            });

            const messageParts: any[] = [{ text: params.userPrompt }];

            for (const file of params.multimodalFiles) {
                messageParts.push({
                    inlineData: { mimeType: file.mimeType, data: file.data }
                });
            }

            if (params.pinnedSource && (params.pinnedSource.type.startsWith('image/') || params.pinnedSource.type === 'application/pdf')) {
                messageParts.push({
                    inlineData: { mimeType: params.pinnedSource.type, data: params.pinnedSource.base64 }
                });
            }

            const result = await model.generateContent({
                contents: [{ role: 'user', parts: messageParts }],
                generationConfig: { temperature: 0.7 }
            });

            return result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';

        } catch (error) {
            console.error('[AiService] compileDocument error:', error);
            throw error;
        }
    }

    /**
     * STAGE 2: Fill values and refine positions using Vision.
     * The AI looks at the PDF, uses the detected fields + user notes,
     * and returns filled values with optimized positions and widths.
     */
    async fillAndRefinePositions(params: {
        pdfBase64: string,
        fields: Array<{ name: string, box: number[], page: number }>,
        userNotes: string,
        sources?: any[]
    }): Promise<Array<{ name: string, value: string, box: number[], width: number, page: number }>> {
        try {
            const model = this.vertex_ai.getGenerativeModel({
                model: this.modelId,
                generationConfig: { responseMimeType: "application/json" }
            });

            const fieldsDescription = params.fields.map(f =>
                `- "${f.name}" a pagina ${f.page}, box [${f.box.join(', ')}]`
            ).join('\n');

            console.log('[AiService Stage 2] Starting fillAndRefinePositions with', params.fields.length, 'fields');
            console.log('[AiService Stage 2] User notes:', params.userNotes?.substring(0, 100) || 'none');

            const prompt = `
Sei un compilatore di documenti PDF con capacità visive avanzate.

COMPITO:
1. GUARDA il documento PDF allegato.
2. Per ogni campo nell'elenco sottostante, inserisci il VALORE appropriato dalle note utente.
3. VERIFICA e CORREGGI le posizioni dei campi guardando il documento reale.
4. CALCOLA la LARGHEZZA ottimale per ogni valore (in scala 0-1000).

CAMPI DA COMPILARE:
${fieldsDescription}

NOTE UTENTE:
${params.userNotes || 'Nessuna nota aggiuntiva.'}

ISTRUZIONI CRITICHE:
- Guarda ESATTAMENTE dove sono gli spazi vuoti nel PDF.
- Se un campo è posizionato male, CORREGGI le coordinate.
- Calcola la larghezza necessaria per il testo inserito.
- Usa nomi semantici in italiano.

FORMATO OUTPUT (JSON):
{
  "fields": [
    {
      "name": "Nome Campo",
      "value": "Valore inserito",
      "box": [ymin, xmin, ymax, xmax],  // Coordinate VERIFICATE (scala 0-1000)
      "width": 150,  // Larghezza calcolata per il testo (scala 0-1000)
      "page": 0
    }
  ]
}
`;

            // Add timeout to prevent infinite waiting
            const timeout = new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error('Stage 2 timeout after 60s')), 60000);
            });

            console.log('[AiService Stage 2] Calling Gemini with 60s timeout...');

            const generatePromise = model.generateContent({
                contents: [
                    {
                        role: 'user',
                        parts: [
                            { text: prompt },
                            { inlineData: { mimeType: 'application/pdf', data: params.pdfBase64 } }
                        ]
                    }
                ]
            });

            const result = await Promise.race([generatePromise, timeout]);

            console.log('[AiService Stage 2] Calling Gemini...');
            const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
            console.log('[AiService Stage 2] Raw response length:', responseText.length);
            console.log('[AiService Stage 2] Raw response preview:', responseText.substring(0, 300));
            const json = JSON.parse(responseText.replace(/```json|```/g, '').trim());

            if (!json.fields || !Array.isArray(json.fields)) {
                console.warn('[AiService] fillAndRefinePositions: No fields in response');
                return [];
            }

            return json.fields.map((item: any) => ({
                name: item.name || 'Campo',
                value: item.value || '',
                box: item.box || [0, 0, 0, 0],
                width: item.width || 100,
                page: item.page || 0
            }));

        } catch (error: any) {
            console.error('[AiService] fillAndRefinePositions error:', error?.message || error);
            console.error('[AiService] fillAndRefinePositions stack:', error?.stack);
            return [];
        }
    }

    /**
     * Compile document using Gemini Function Calling
     * Gives AI full control over document with real-time feedback
     */
    async compileWithTools(params: {
        pdfBase64: string,
        fields: Array<{ name: string, x: number, y: number, width: number, height: number, pageIndex: number }>,
        userNotes: string,
        sources?: Array<{ name: string, base64: string, type: string }>
    }): Promise<Array<{ x: number, y: number, text: string, fontSize: number, pageIndex: number, fieldName?: string }>> {

        console.log('[AiService] compileWithTools: Starting with', params.fields.length, 'fields');

        // Define function declarations for Gemini
        const functionDeclarations = [
            {
                name: "readDocumentFields",
                description: "Legge tutti i campi disponibili nel documento con le loro posizioni esatte. Chiamare all'inizio per sapere dove piazzare il testo.",
                parameters: {
                    type: "object",
                    properties: {},
                    required: []
                }
            },
            {
                name: "placeText",
                description: "Piazza del testo a coordinate specifiche nel documento PDF. Usa le coordinate ottenute da readDocumentFields.",
                parameters: {
                    type: "object",
                    properties: {
                        fieldName: {
                            type: "string",
                            description: "Nome del campo dove piazzare il testo (per logging)"
                        },
                        x: {
                            type: "number",
                            description: "Coordinata X in pixel (dal bordo sinistro)"
                        },
                        y: {
                            type: "number",
                            description: "Coordinata Y in pixel (dal bordo inferiore, sistema PDF)"
                        },
                        text: {
                            type: "string",
                            description: "Il testo da inserire"
                        },
                        fontSize: {
                            type: "number",
                            description: "Dimensione font in punti (default 11)"
                        },
                        pageIndex: {
                            type: "number",
                            description: "Indice della pagina (0-based, default 0)"
                        }
                    },
                    required: ["fieldName", "x", "y", "text"]
                }
            },
            {
                name: "done",
                description: "Segnala che la compilazione è completa. Chiamare quando tutti i campi sono stati riempiti.",
                parameters: {
                    type: "object",
                    properties: {
                        summary: {
                            type: "string",
                            description: "Breve riepilogo dei campi compilati"
                        }
                    },
                    required: []
                }
            }
        ];

        const model = this.vertex_ai.getGenerativeModel({
            model: this.modelId,
            tools: [{ functionDeclarations }] as any
        });

        // Build source context
        let sourceContext = '';
        if (params.sources && params.sources.length > 0) {
            sourceContext = params.sources.map(s => `Fonte: ${s.name}`).join('\n');
        }

        const systemPrompt = `Sei un assistente per la compilazione precisa di documenti PDF.

ISTRUZIONI:
1. PRIMA chiama readDocumentFields() per ottenere la lista dei campi con posizioni esatte
2. Per ogni campo, usa le note dell'utente per trovare il valore corretto
3. Chiama placeText() per ogni campo con le coordinate ESATTE ricevute
4. Quando hai finito tutti i campi, chiama done()

NOTE UTENTE:
${params.userNotes}

${sourceContext ? `FONTI DISPONIBILI:\n${sourceContext}` : ''}

IMPORTANTE:
- Usa SEMPRE le coordinate esatte ricevute da readDocumentFields
- Non inventare coordinate
- Se non trovi un valore per un campo, lascialo vuoto (non chiamare placeText)
- Font size consigliato: 10-12 punti`;

        // State for placed texts
        const placedTexts: Array<{ x: number, y: number, text: string, fontSize: number, pageIndex: number, fieldName?: string }> = [];
        let isDone = false;

        // Start conversation
        let messages: any[] = [
            { role: 'user', parts: [{ text: systemPrompt }] }
        ];

        // Tool execution loop
        let iterations = 0;
        const maxIterations = 20;

        while (!isDone && iterations < maxIterations) {
            iterations++;
            console.log(`[AiService] compileWithTools: Iteration ${iterations}`);

            const response = await model.generateContent({ contents: messages });
            const candidate = response.response.candidates?.[0];

            if (!candidate?.content?.parts) {
                console.error('[AiService] No response parts');
                break;
            }

            // Add assistant response to conversation
            messages.push({ role: 'model', parts: candidate.content.parts });

            // Check for function calls
            const functionCalls = candidate.content.parts.filter((p: any) => p.functionCall);

            if (functionCalls.length === 0) {
                console.log('[AiService] No function calls, checking for text response');
                break;
            }

            // Process each function call
            const functionResponses: any[] = [];

            for (const part of functionCalls) {
                const fc = (part as any).functionCall;
                if (!fc) continue;

                console.log(`[AiService] Function call: ${fc.name}`, fc.args);

                let result: any;
                const args = fc.args || {};

                switch (fc.name) {
                    case 'readDocumentFields':
                        result = params.fields.map(f => ({
                            name: f.name,
                            x: Math.round(f.x),
                            y: Math.round(f.y),
                            width: Math.round(f.width),
                            height: Math.round(f.height),
                            pageIndex: f.pageIndex
                        }));
                        console.log(`[AiService] Returning ${result.length} fields`);
                        break;

                    case 'placeText':
                        const { fieldName, x, y, text, fontSize = 11, pageIndex = 0 } = args as any;
                        if (text && String(text).trim()) {
                            placedTexts.push({
                                x: Number(x),
                                y: Number(y),
                                text: String(text),
                                fontSize: Number(fontSize),
                                pageIndex: Number(pageIndex),
                                fieldName: String(fieldName)
                            });
                            result = { success: true, placedAt: { x, y }, field: fieldName };
                            console.log(`[AiService] Placed "${text}" at (${x}, ${y}) for ${fieldName}`);
                        } else {
                            result = { success: false, error: 'Empty text' };
                        }
                        break;

                    case 'done':
                        isDone = true;
                        result = { success: true, totalPlaced: placedTexts.length };
                        console.log(`[AiService] Done! Placed ${placedTexts.length} texts`);
                        break;

                    default:
                        result = { error: 'Unknown function' };
                }

                functionResponses.push({
                    functionResponse: {
                        name: fc.name,
                        response: { output: JSON.stringify(result) }
                    }
                });
            }

            // Add function responses to conversation
            messages.push({ role: 'user', parts: functionResponses });
        }

        console.log(`[AiService] compileWithTools complete: ${placedTexts.length} texts placed in ${iterations} iterations`);
        return placedTexts;
    }
}
