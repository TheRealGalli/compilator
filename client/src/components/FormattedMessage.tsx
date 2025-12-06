import React from 'react';

interface FormattedMessageProps {
    content: string;
    className?: string;
}

export function FormattedMessage({ content, className = '' }: FormattedMessageProps) {
    // Format inline markdown (bold) and strip markers
    const formatLine = (text: string, lineIndex: number) => {
        if (!text) return <div key={lineIndex} className="h-4" />; // Empty line

        const parts: (string | JSX.Element)[] = [];
        let currentText = text;
        let keyCounter = 0;

        // Handle bold: **text** -> <strong>text</strong>
        const boldRegex = /\*\*(.+?)\*\*/g;
        let lastIndex = 0;
        let match;

        while ((match = boldRegex.exec(currentText)) !== null) {
            // Add text before the match
            if (match.index > lastIndex) {
                parts.push(currentText.substring(lastIndex, match.index));
            }
            // Add bold text (without the **)
            parts.push(
                <strong key={`bold-${lineIndex}-${keyCounter++}`} className="font-semibold text-foreground">
                    {match[1]}
                </strong>
            );
            lastIndex = match.index + match[0].length;
        }

        // Add remaining text
        if (lastIndex < currentText.length) {
            parts.push(currentText.substring(lastIndex));
        }

        // If no bold found, just return text
        if (parts.length === 0) {
            parts.push(text);
        }

        return (
            <div key={lineIndex} className="whitespace-pre-wrap">
                {parts}
            </div>
        );
    };

    return (
        <div
            className={`formatted-message font-mono text-sm leading-relaxed ${className}`}
            style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            }}
        >
            {content.split('\n').map((line, index) => formatLine(line, index))}
        </div>
    );
}
