import { VertexAI } from '@google-cloud/vertexai';

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
     * Compiles the document using strict context from sources.
     */
    async compileDocument(params: {
        systemPrompt: string,
        userPrompt: string,
        multimodalFiles: any[],
        masterSource?: any // Renamed from pinnedSource
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
                if ((file.mimeType || file.type) && (file.data || file.base64)) {
                    messageParts.push({
                        inlineData: {
                            mimeType: file.mimeType || file.type,
                            data: file.data || file.base64
                        }
                    });
                }
            }

            if (params.masterSource && params.masterSource.base64) {
                messageParts.push({
                    inlineData: {
                        mimeType: params.masterSource.type || 'application/pdf',
                        data: params.masterSource.base64
                    }
                });
            }

            const result = await model.generateContent({
                contents: [{ role: 'user', parts: messageParts }],
                generationConfig: { temperature: 0.2 } // Low temp for factual compilation
            });

            return result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';

        } catch (error) {
            console.error('[AiService] compileDocument error:', error);
            throw error;
        }
    }

    /**
     * Refines the formatting of a draft document using a secondary AI pass (Layout Agent).
     */
    async refineFormatting(params: {
        draftContent: string,
        masterSource?: any,
        formalTone?: boolean
    }): Promise<string> {
        try {
            const systemPrompt = `Sei un esperto di Desktop Publishing e Layout Design.
Il tuo compito è prendere una BOZZA di testo e rifinirla esteticamente senza cambiarne il senso.

**REGOLE DI FORMATTAZIONE (LAYOUT AGENT):**
1. **TABELLE:** Se vedi dati comparativi o elenchi che trarrebbero vantaggio da una tabella, trasformali in tabelle Markdown (es: | Col 1 | Col 2 |).
2. **GERARCHIA:** Usa Markdown standard per i titoli (# Titolo, ## Sottotitolo).
3. **ENFASI:** Usa il **grassetto** per termini chiave, date o importi importanti.
4. **LISTE:** Usa elenchi puntati o numerati puliti.
5. **MASTER ALIGNMENT:** Se fornito un "Master Source", cerca di replicarne fedelmente la struttura delle sezioni e l'uso di tabelle.

**RESTRIZIONI:**
- Restituisci SOLO il testo rifinito.
- Non aggiungere commenti personali.
- Mantieni rigorosamente i dati della bozza.`;

            const userPrompt = `Rifinisci la seguente bozza seguendo le regole di layout.
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

            const messageParts: any[] = [{ text: userPrompt }];

            if (params.masterSource && params.masterSource.base64) {
                messageParts.push({
                    inlineData: {
                        mimeType: params.masterSource.type || 'application/pdf',
                        data: params.masterSource.base64
                    }
                });
            }

            const result = await model.generateContent({
                contents: [{ role: 'user', parts: messageParts }],
                generationConfig: { temperature: 0.1 } // Very low temperature for consistency
            });

            return result.response.candidates?.[0]?.content?.parts?.[0]?.text || params.draftContent;

        } catch (error) {
            console.error('[AiService] refineFormatting error:', error);
            return params.draftContent; // Fallback to draft on error
        }
    }
}
