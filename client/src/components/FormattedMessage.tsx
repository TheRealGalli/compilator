import React from 'react';

interface FormattedMessageProps {
    content: string;
    className?: string;
}

export function FormattedMessage({ content, className = '' }: FormattedMessageProps) {
    // Parse markdown-like content and convert to formatted HTML
    const formatContent = (text: string) => {
        const lines = text.split('\n');
        const elements: JSX.Element[] = [];
        let currentParagraph: string[] = [];
        let key = 0;

        const flushParagraph = () => {
            if (currentParagraph.length > 0) {
                const paragraphText = currentParagraph.join(' ');
                elements.push(
                    <p key={`p-${key++}`} className="mb-3 leading-relaxed">
                        {formatInlineMarkdown(paragraphText)}
                    </p>
                );
                currentParagraph = [];
            }
        };

        lines.forEach((line, index) => {
            const trimmedLine = line.trim();

            // Handle bullet points (*, -, •)
            if (/^[\*\-\•]\s/.test(trimmedLine)) {
                flushParagraph();
                const bulletContent = trimmedLine.replace(/^[\*\-\•]\s/, '');
                elements.push(
                    <div key={`bullet-${key++}`} className="flex gap-3 mb-2 pl-1">
                        <span className="text-orange-500 font-bold text-lg leading-tight mt-0.5">•</span>
                        <span className="flex-1 leading-relaxed">{formatInlineMarkdown(bulletContent)}</span>
                    </div>
                );
            }
            // Handle numbered lists
            else if (/^\d+\.\s/.test(trimmedLine)) {
                flushParagraph();
                const match = trimmedLine.match(/^(\d+)\.\s(.+)$/);
                if (match) {
                    const [, number, listContent] = match;
                    elements.push(
                        <div key={`numbered-${key++}`} className="flex gap-3 mb-2 pl-1">
                            <span className="text-orange-500 font-semibold min-w-[24px]">{number}.</span>
                            <span className="flex-1 leading-relaxed">{formatInlineMarkdown(listContent)}</span>
                        </div>
                    );
                }
            }
            // Empty line - flush paragraph
            else if (trimmedLine === '') {
                flushParagraph();
            }
            // Regular text - accumulate for paragraph
            else {
                currentParagraph.push(trimmedLine);
            }
        });

        // Flush any remaining paragraph
        flushParagraph();

        return elements;
    };

    // Format inline markdown (bold, italic, code, etc.)
    const formatInlineMarkdown = (text: string) => {
        const parts: (string | JSX.Element)[] = [];
        let currentText = text;
        let keyCounter = 0;

        // Remove ** and apply bold styling via CSS
        // Pattern: **text** -> <strong>text</strong>
        const boldRegex = /\*\*(.+?)\*\*/g;
        let lastIndex = 0;
        let match;

        while ((match = boldRegex.exec(currentText)) !== null) {
            // Add text before the match
            if (match.index > lastIndex) {
                parts.push(currentText.substring(lastIndex, match.index));
            }
            // Add bold text
            parts.push(
                <strong key={`bold-${keyCounter++}`} className="font-semibold">
                    {match[1]}
                </strong>
            );
            lastIndex = match.index + match[0].length;
        }

        // Add remaining text
        if (lastIndex < currentText.length) {
            parts.push(currentText.substring(lastIndex));
        }

        return parts.length > 0 ? parts : text;
    };

    return (
        <div
            className={`formatted-message font-sans ${className}`}
            style={{
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", "Helvetica Neue", Arial, sans-serif',
                fontSize: '15px',
                lineHeight: '1.6',
                color: 'inherit'
            }}
        >
            {formatContent(content)}
        </div>
    );
}
