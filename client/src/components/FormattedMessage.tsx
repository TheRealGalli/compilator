import React from 'react';

interface FormattedMessageProps {
    content: string;
    className?: string;
}

export function FormattedMessage({ content, className = '' }: FormattedMessageProps) {
    // Format line with highlighting (bold and bullets)
    const formatLine = (text: string, lineIndex: number) => {
        if (!text) return <div key={lineIndex} className="h-4" />; // Empty line

        // Check for headers (Lines starting with #)
        const headerMatch = text.match(/^(#{1,6})\s+(.*)/);
        if (headerMatch) {
            const [, hashes, title] = headerMatch;
            const level = hashes.length;
            const sizeClass = level === 1 ? "text-lg font-bold mt-4 mb-2" :
                level === 2 ? "text-base font-bold mt-3 mb-2" :
                    "text-sm font-bold mt-2 mb-1";

            return (
                <div key={lineIndex} className={`${sizeClass} text-foreground`}>
                    {formatInline(title, lineIndex)}
                </div>
            );
        }

        // Check for bullet points to highlight them
        // Matches: * text, - text, or indented versions
        const bulletMatch = text.match(/^(\s*)([\*\-\•])(\s+)(.*)/);

        if (bulletMatch) {
            const [, indent, bullet, space, content] = bulletMatch;
            return (
                <div key={lineIndex} className="whitespace-pre-wrap py-0.5">
                    {indent}
                    <span className="text-blue-600 font-bold">{bullet}</span>
                    {space}
                    {formatInline(content, lineIndex)}
                </div>
            );
        }

        return (
            <div key={lineIndex} className="whitespace-pre-wrap min-h-[1.2em]">
                {formatInline(text, lineIndex)}
            </div>
        );
    };

    // Format inline text (bold **...**)
    const formatInline = (text: string, lineIndex: number) => {
        const parts: (string | JSX.Element)[] = [];
        let currentText = text;
        let keyCounter = 0;

        // Handle bold: **text** -> <strong>text</strong>
        const boldRegex = /\*\*(.+?)\*\*/g;
        let lastIndex = 0;
        let match;

        while ((match = boldRegex.exec(currentText)) !== null) {
            if (match.index > lastIndex) {
                parts.push(currentText.substring(lastIndex, match.index));
            }
            parts.push(
                <strong key={`bold-${lineIndex}-${keyCounter++}`} className="font-semibold text-foreground">
                    {match[1]}
                </strong>
            );
            lastIndex = match.index + match[0].length;
        }

        if (lastIndex < currentText.length) {
            parts.push(currentText.substring(lastIndex));
        }

        return parts.length > 0 ? parts : text;
    };

    return (
        <div
            className={`formatted-message text-sm leading-relaxed ${className} break-words overflow-wrap-anywhere`}
        >
            {content.split('\n').map((line, index) => formatLine(line, index))}
        </div>
    );
}
