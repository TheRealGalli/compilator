import { pipeline, env } from '@xenova/transformers';

// Configure to use local WASM and allow remote models from HF Hub
env.allowLocalModels = false;
env.useBrowserCache = true;

/**
 * Singleton Class to manage the NER model.
 * Loads the model once and reuses it for high performance.
 */
class NEREngine {
    private static instance: NEREngine;
    private pipe: any = null;
    private modelName = 'Xenova/bert-base-multilingual-cased-ner'; // Quantized version
    private isLoading = false;

    private constructor() { }

    public static getInstance(): NEREngine {
        if (!NEREngine.instance) {
            NEREngine.instance = new NEREngine();
        }
        return NEREngine.instance;
    }

    /**
     * Initializes the model. Safe to call multiple times (checks if already loaded).
     */
    public async loadModel(progressCallback?: (data: any) => void): Promise<void> {
        if (this.pipe) return;
        if (this.isLoading) {
            // Wait for existing load to finish
            return new Promise((resolve) => {
                const check = setInterval(() => {
                    if (this.pipe) {
                        clearInterval(check);
                        resolve();
                    }
                }, 100);
            });
        }

        this.isLoading = true;
        try {
            console.log(`[NER-Engine] Loading model: ${this.modelName}...`);
            this.pipe = await pipeline('token-classification', this.modelName, {
                quantized: true, // Use quantized model for smaller size/speed
                progress_callback: progressCallback
            });
            console.log('[NER-Engine] Model loaded successfully.');
        } catch (error) {
            console.error('[NER-Engine] Failed to load model:', error);
            throw error;
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Extracts named entities from text.
     * Maps them to our internal types: FULL_NAME, ORGANIZATION, LOCATION.
     */
    public async extractEntities(text: string): Promise<any[]> {
        if (!this.pipe) await this.loadModel();

        // 1. Run Inference
        // ignore_labels: [] ensures we get all labels. 
        // aggregation_strategy: 'simple' or 'first' helps merge "Ma" "rio" -> "Mario"
        const output = await this.pipe(text, {
            aggregation_strategy: 'simple'
        });

        // 2. Map Results
        // HF Output: { entity_group: 'PER', score: 0.99, word: 'Mario Rossi', start: 10, end: 21 }
        return output.map((entity: any) => {
            let type = 'UNKNOWN';

            // Map BERT tags to Gromit types
            switch (entity.entity_group) {
                case 'PER': type = 'FULL_NAME'; break;
                case 'ORG': type = 'ORGANIZATION'; break;
                case 'LOC': type = 'PLACE_OF_BIRTH'; break; // Approximate LOC as Place
                default: return null;
            }

            return {
                value: entity.word.trim(),
                type: type,
                confidence: entity.score > 0.9 ? 'HIGH' : 'MEDIUM',
                index: entity.start
            };
        }).filter((item: any) => item !== null && item.value.length > 2);
    }
}

export const nerEngine = NEREngine.getInstance();
