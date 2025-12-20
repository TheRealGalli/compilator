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
      You are a layout analysis engine.
      Detect all form fields where data should be entered (underscores, boxes, empty spaces).
      For each field, provide:
      1. "name": A specific, semantic label (e.g. "Surname", "Date of Birth", "Signature").
      2. "box_2d": The bounding box as [ymin, xmin, ymax, xmax] on a 0-1000 scale.

      Return JSON: { "data": [ { "name": "...", "box_2d": [0,0,0,0] } ] }
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
}
