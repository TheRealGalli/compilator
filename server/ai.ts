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
        multimodalFiles: any[]
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
                if (!file.mimeType || !file.data) {
                    console.warn('[AiService] Skipping file with missing mimeType or data:', file);
                    continue;
                }
                messageParts.push({
                    inlineData: { mimeType: file.mimeType, data: file.data }
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
}
