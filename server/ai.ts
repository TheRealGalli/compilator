import { VertexAI } from '@google-cloud/vertexai';

export class AiService {
    private vertex_ai: VertexAI;
    private modelId = 'gemini-2.5-flash';

    constructor(projectId: string, location: string = 'europe-west1') {
        this.vertex_ai = new VertexAI({ project: projectId, location });
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
      Agisci come un motore di analisi layout per documenti.
      Rileva tutti i campi del modulo dove dovrebbero essere inseriti dati (underscore, caselle, spazi vuoti, righe di firma).
      Per ogni campo, fornisci:
      1. "name": Un'etichetta semantica specifica in ITALIANO (es. "Cognome", "Data di Nascita", "Firma", "Indirizzo").
      2. "box_2d": Il bounding box come [ymin, xmin, ymax, xmax] su scala 0-1000.

      Restituisci JSON: { "data": [ { "name": "...", "box_2d": [0,0,0,0] } ] }
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
                const [ymin, xmin, ymax, xmax] = item.box_2d;
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
                    pageIndex: 0,
                    source: 'gemini_vision'
                };
            });

        } catch (error) {
            console.error('[AiService] analyzeLayout error:', error);
            return [];
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
}
