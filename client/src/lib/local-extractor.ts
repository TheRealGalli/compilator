import { toast } from "@/hooks/use-toast";

export interface ExtractedDocument {
    name: string;
    text: string;
    type: string;
}

/**
 * Checks if the Gromit Bridge extension is available in the DOM.
 */
function isBridgeAvailable(): boolean {
    return (
        document.documentElement.getAttribute('data-gromit-bridge-active') === 'true' ||
        (window as any).__GROMIT_BRIDGE_ACTIVE__ === true
    );
}

/**
 * Helper to convert File to Base64 (for extension messaging)
 */
function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result as string;
            // Remove Data URI prefix (e.g., "data:application/pdf;base64,")
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = error => reject(error);
    });
}

/**
 * Sends a message to the Gromit Bridge extension to extract text.
 */
async function extractViaBridge(file: File): Promise<string> {
    if (!isBridgeAvailable()) {
        throw new Error("Gromit Bridge extension not found. Please install or activate it.");
    }

    const fileBase64 = await fileToBase64(file);

    return new Promise((resolve, reject) => {
        const requestId = Math.random().toString(36).substring(7);
        const timeout = setTimeout(() => {
            window.removeEventListener('GROMIT_BRIDGE_RESPONSE', handler);
            reject(new Error("Timeout waiting for Gromit Bridge extraction (60s)."));
        }, 60000); // 60s timeout for heavy extraction

        const handler = (event: any) => {
            if (event.detail.requestId === requestId) {
                clearTimeout(timeout);
                window.removeEventListener('GROMIT_BRIDGE_RESPONSE', handler);
                const response = event.detail.response;

                if (response.success) {
                    console.log(`[LocalExtractor] Extracted Text Preview (from Bridge):\n${response.text.substring(0, 500)}...\n[...${response.text.length} chars total]`);
                    resolve(response.text);
                } else {
                    reject(new Error(response.error || "Unknown Bridge Error"));
                }
            }
        };

        window.addEventListener('GROMIT_BRIDGE_RESPONSE', handler);
        window.dispatchEvent(new CustomEvent('GROMIT_BRIDGE_REQUEST', {
            detail: {
                detail: {
                    type: 'EXTRACT_AND_ANALYZE',
                    fileBase64,
                    fileName: file.name,
                    fileType: file.type
                },
                requestId
            }
        }));
    });
}

/**
 * Extracts raw text from a File using the Gromit Bridge Extension ("Sanctuary").
 */
export async function extractTextLocally(file: File): Promise<string> {
    const fileName = file.name.toLowerCase();

    // Fallback for plain text files (can be done locally without libs)
    if (
        file.type.startsWith('text/') ||
        fileName.endsWith('.txt') ||
        fileName.endsWith('.md') ||
        fileName.endsWith('.csv') ||
        fileName.endsWith('.json') ||
        fileName.endsWith('.xml') ||
        fileName.endsWith('.html')
    ) {
        return await extractPlainText(file);
    }

    try {
        if (isBridgeAvailable()) {
            console.log(`[LocalExtractor] Offloading ${fileName} to Gromit Bridge "Sanctuary"...`);
            return await extractViaBridge(file);
        } else {
            console.warn(`[LocalExtractor] Bridge missing. Cannot extract complex file: ${fileName}`);
            toast({
                title: "Estensione Mancante",
                description: "Per analizzare PDF/Excel/Docx in sicurezza locale, l'estensione Gromit Bridge è necessaria.",
                variant: "destructive"
            });
            return `[ERRORE: Estensione Gromit Bridge non attiva. Impossibile leggere ${fileName} in modalità sicura.]`;
        }
    } catch (error: any) {
        console.error(`[LocalExtractor] Error extracting text from ${fileName}:`, error);
        return `[ERRORE: Impossibile leggere il file ${fileName}. Dettagli: ${error.message}]`;
    }
}

// Helper for local plaintext extraction (Zero-Dependency)
async function extractPlainText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).trim());
        reader.onerror = reject;
        reader.readAsText(file);
    });
}
