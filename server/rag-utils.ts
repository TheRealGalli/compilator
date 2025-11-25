/**
 * RAG (Retrieval-Augmented Generation) Utilities
 * Provides document chunking and smart context retrieval
 */

export interface DocumentChunk {
    id: string;
    documentName: string;
    documentPath: string;
    content: string;
    chunkIndex: number;
    totalChunks: number;
    metadata?: {
        pageNumber?: number;
        section?: string;
    };
}

export interface ChunkedDocument {
    documentName: string;
    documentPath: string;
    chunks: DocumentChunk[];
    createdAt: string;
}

/**
 * Split text into semantic chunks of approximately maxTokens each
 * Uses sentence boundaries to avoid breaking mid-sentence
 */
export function chunkText(
    text: string,
    documentName: string,
    documentPath: string,
    maxTokens: number = 1000
): DocumentChunk[] {
    // Rough estimate: 1 token ≈ 4 characters
    const maxChars = maxTokens * 4;

    // Split by paragraphs first
    const paragraphs = text.split(/\n\n+/);
    const chunks: DocumentChunk[] = [];
    let currentChunk = '';
    let chunkIndex = 0;

    for (const paragraph of paragraphs) {
        const trimmedParagraph = paragraph.trim();
        if (!trimmedParagraph) continue;

        // If adding this paragraph would exceed maxChars, save current chunk
        if (currentChunk && (currentChunk.length + trimmedParagraph.length > maxChars)) {
            chunks.push({
                id: `${documentPath}_chunk_${chunkIndex}`,
                documentName,
                documentPath,
                content: currentChunk.trim(),
                chunkIndex,
                totalChunks: 0, // Will be updated later
            });
            currentChunk = '';
            chunkIndex++;
        }

        currentChunk += (currentChunk ? '\n\n' : '') + trimmedParagraph;
    }

    // Add the last chunk if it's not empty
    if (currentChunk.trim()) {
        chunks.push({
            id: `${documentPath}_chunk_${chunkIndex}`,
            documentName,
            documentPath,
            content: currentChunk.trim(),
            chunkIndex,
            totalChunks: 0,
        });
    }

    // Update totalChunks for all chunks
    const totalChunks = chunks.length;
    chunks.forEach(chunk => chunk.totalChunks = totalChunks);

    return chunks;
}

/**
 * Calculate keyword-based relevance score between query and text
 */
function calculateRelevanceScore(query: string, text: string): number {
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const textLower = text.toLowerCase();

    let score = 0;

    // Count exact matches (higher weight)
    for (const word of queryWords) {
        const matches = (textLower.match(new RegExp(word, 'g')) || []).length;
        score += matches * 2;
    }

    // Count partial matches
    const words = textLower.split(/\s+/);
    for (const word of queryWords) {
        for (const textWord of words) {
            if (textWord.includes(word) && textWord !== word) {
                score += 0.5;
            }
        }
    }

    return score;
}

export interface RelevantChunk extends DocumentChunk {
    relevanceScore: number;
}

/**
 * Select the most relevant chunks for a given query
 * Ensures diversity across documents and respects token limit
 */
export function selectRelevantChunks(
    allChunks: DocumentChunk[],
    query: string,
    maxTotalTokens: number = 8000,
    maxChunksPerDocument: number = 3
): RelevantChunk[] {
    // Calculate relevance scores
    const scoredChunks: RelevantChunk[] = allChunks.map(chunk => ({
        ...chunk,
        relevanceScore: calculateRelevanceScore(query, chunk.content),
    }));

    // Sort by relevance score (descending)
    scoredChunks.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Select chunks with diversity
    const selected: RelevantChunk[] = [];
    const documentChunkCount = new Map<string, number>();
    let totalTokens = 0;

    for (const chunk of scoredChunks) {
        // Estimate tokens (rough: chars / 4)
        const chunkTokens = chunk.content.length / 4;

        // Check if we've reached limits
        if (totalTokens + chunkTokens > maxTotalTokens) {
            break;
        }

        const currentCount = documentChunkCount.get(chunk.documentPath) || 0;
        if (currentCount >= maxChunksPerDocument) {
            continue;
        }

        // Add this chunk
        selected.push(chunk);
        documentChunkCount.set(chunk.documentPath, currentCount + 1);
        totalTokens += chunkTokens;
    }

    return selected;
}

/**
 * Format selected chunks into a context string with citations
 */
export function formatContextWithCitations(chunks: RelevantChunk[]): string {
    if (chunks.length === 0) {
        return '';
    }

    let context = 'CONTESTO DAI DOCUMENTI SELEZIONATI:\n\n';

    // Group by document
    const byDocument = new Map<string, RelevantChunk[]>();
    for (const chunk of chunks) {
        const existing = byDocument.get(chunk.documentPath) || [];
        existing.push(chunk);
        byDocument.set(chunk.documentPath, existing);
    }

    // Format each document's chunks
    for (const [docPath, docChunks] of Array.from(byDocument.entries())) {
        const docName = docChunks[0].documentName;
        context += `--- ${docName} ---\n\n`;

        // Sort by chunk index to maintain order
        docChunks.sort((a: RelevantChunk, b: RelevantChunk) => a.chunkIndex - b.chunkIndex);

        for (const chunk of docChunks) {
            context += `${chunk.content}\n\n`;
        }
    }

    context += '\n---\n\n';
    context += 'Usa il contesto sopra per rispondere alla domanda. Cita i documenti quando possibile.\n';

    return context;
}

/**
 * Extract keywords from a query for better retrieval
 */
export function extractKeywords(query: string): string[] {
    // Remove common words
    const commonWords = new Set([
        'qual', 'è', 'sono', 'il', 'la', 'le', 'i', 'di', 'da', 'in', 'con',
        'per', 'su', 'tra', 'fra', 'a', 'come', 'quando', 'dove', 'perché',
        'cosa', 'chi', 'quanto', 'quale', 'dei', 'delle', 'del', 'della',
        'the', 'is', 'are', 'was', 'were', 'what', 'where', 'when', 'how', 'why'
    ]);

    return query
        .toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 3 && !commonWords.has(word));
}
