import React from 'react';

interface FormattedMessageProps {
    content: string;
    className?: string;
}

export function FormattedMessage({ content, className = '' }: FormattedMessageProps) {
    const lines = content.split('\n');
    const elements: JSX.Element[] = [];

    // Helper to format inline text (bold **...**)
    const formatInline = (text: string, lineIndex: number | string) => {
        const parts: (string | JSX.Element)[] = [];
        const currentText = text;
        let keyCounter = 0;

        // We'll replace bold first, then handle checkboxes within the remaining parts
        const boldRegex = /\*\*(.+?)\*\*/g;
        let lastIndex = 0;
        let match;

        while ((match = boldRegex.exec(currentText)) !== null) {
            if (match.index > lastIndex) {
                const textPart = currentText.substring(lastIndex, match.index);
                parts.push(...renderCheckboxes(textPart, `text-${lineIndex}-${keyCounter++}`));
            }
            parts.push(
                <strong key={`bold-${lineIndex}-${keyCounter++}`} className="font-semibold text-foreground">
                    {formatInline(match[1], `bold-inner-${lineIndex}-${keyCounter}`)}
                </strong>
            );
            lastIndex = match.index + match[0].length;
        }

        if (lastIndex < currentText.length) {
            const textPart = currentText.substring(lastIndex);
            parts.push(...renderCheckboxes(textPart, `text-end-${lineIndex}-${keyCounter++}`));
        }

        return parts.length > 0 ? parts : currentText;
    };

    // Helper to render checkboxes [x] and [ ] as UI elements
    const renderCheckboxes = (text: string, baseKey: string) => {
        const checkboxParts: (string | JSX.Element)[] = [];
        const checkboxRegex = /\[([ xX])\]/g;
        let lastIdx = 0;
        let cMatch;
        let cCounter = 0;

        while ((cMatch = checkboxRegex.exec(text)) !== null) {
            if (cMatch.index > lastIdx) {
                checkboxParts.push(text.substring(lastIdx, cMatch.index));
            }
            const isChecked = cMatch[1].toLowerCase() === 'x';
            checkboxParts.push(
                <span key={`${baseKey}-cb-${cCounter++}`} className="inline-flex items-center mx-1">
                    {isChecked ? (
                        <span className="w-4 h-4 rounded border border-blue-500 bg-blue-500 flex items-center justify-center text-[10px] text-white font-bold">✓</span>
                    ) : (
                        <span className="w-4 h-4 rounded border border-muted-foreground/40 bg-muted/20 flex items-center justify-center" />
                    )}
                </span>
            );
            lastIdx = cMatch.index + cMatch[0].length;
        }

        if (lastIdx < text.length) {
            checkboxParts.push(text.substring(lastIdx));
        }

        return checkboxParts;
    };

    let i = 0;
    while (i < lines.length) {
        const line = lines[i].trim();

        // 1. Detect Tables (| col | col |)
        if (line.startsWith('|') && line.endsWith('|')) {
            const tableRows: string[][] = [];
            let j = i;

            while (j < lines.length && lines[j].trim().startsWith('|') && lines[j].trim().endsWith('|')) {
                const rawLine = lines[j].trim();
                // Skip separator lines (| --- | --- |) but keep track of them for styling if needed
                if (!rawLine.match(/^[|\s\-:]+$/)) {
                    const cells = rawLine.split('|').slice(1, -1).map(c => c.trim());
                    tableRows.push(cells);
                }
                j++;
            }

            if (tableRows.length > 0) {
                elements.push(
                    <div key={`table-${i}`} className="my-4 overflow-x-auto rounded-lg border border-border shadow-sm">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-muted/50 border-b border-border">
                                    {tableRows[0].map((cell, idx) => (
                                        <th key={`th-${idx}`} className="p-3 text-xs font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                                            {formatInline(cell, `th-${i}-${idx}`)}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {tableRows.slice(1).map((row, rowIdx) => (
                                    <tr key={`tr-${rowIdx}`} className="hover:bg-muted/30 transition-colors">
                                        {row.map((cell, colIdx) => (
                                            <td key={`td-${colIdx}`} className="p-3 text-sm">
                                                {formatInline(cell, `td-${i}-${rowIdx}-${colIdx}`)}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );
            }
            i = j; // Move to the end of the table
            continue;
        }

        // 2. Detect Headers
        const headerMatch = line.match(/^(#{1,6})\s+(.*)/);
        if (headerMatch) {
            const [, hashes, title] = headerMatch;
            const level = hashes.length;
            const sizeClass = level === 1 ? "text-2xl font-bold mt-8 mb-4" :
                level === 2 ? "text-xl font-bold mt-6 mb-3" :
                    "text-lg font-bold mt-5 mb-2";

            elements.push(
                <div key={`header-${i}`} className={`${sizeClass} text-foreground border-b border-border/40 pb-2`}>
                    {formatInline(title, `header-${i}`)}
                </div>
            );
            i++;
            continue;
        }

        // 3. Detect Bullet Points
        const bulletMatch = line.match(/^(\s*)([\*\-\•])(\s+)(.*)/);
        if (bulletMatch) {
            const [, indent, bullet, space, content] = bulletMatch;
            elements.push(
                <div key={`bullet-${i}`} className="flex items-start gap-2 py-1 ml-4">
                    <span className="text-blue-500 font-bold mt-1.5">•</span>
                    <div className="flex-1 whitespace-pre-wrap">
                        {formatInline(content, `bullet-${i}`)}
                    </div>
                </div>
            );
            i++;
            continue;
        }

        // 4. Regular Lines
        if (line === '') {
            elements.push(<div key={`empty-${i}`} className="h-2" />);
        } else {
            elements.push(
                <div key={`p-${i}`} className="py-1 whitespace-pre-wrap leading-relaxed text-foreground/90">
                    {formatInline(lines[i], `p-${i}`)}
                </div>
            );
        }
        i++;
    }

    return (
        <div className={`formatted-message text-base ${className} space-y-1`}>
            {elements}
        </div>
    );
}
