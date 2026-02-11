import React from 'react';
import { cn } from '@/lib/utils';

interface FormattedMessageProps {
    content: string;
    className?: string;
}



export function FormattedMessage({ content, className = '' }: FormattedMessageProps) {
    if (!content) return null;

    const lines = content.split('\n');
    const elements: JSX.Element[] = [];

    // Helper to format inline text (bold **...**)
    const formatInline = (text: string, lineIndex: number | string) => {
        const parts: (string | JSX.Element)[] = [];
        let currentText = text;
        let keyCounter = 0;

        // 1. Handle Inline Math ($...$)
        const mathRegex = /\$([^$]+)\$/g;
        let lastMathIdx = 0;
        let mathMatch;
        let mathCounter = 0;

        // Collect math parts first
        const mathSegments: { type: 'text' | 'math', content: string, key: string }[] = [];
        while ((mathMatch = mathRegex.exec(currentText)) !== null) {
            if (mathMatch.index > lastMathIdx) {
                mathSegments.push({ type: 'text', content: currentText.substring(lastMathIdx, mathMatch.index), key: `math-text-${lineIndex}-${keyCounter++}` });
            }
            mathSegments.push({ type: 'math', content: mathMatch[1], key: `math-${lineIndex}-${mathCounter++}` });
            lastMathIdx = mathMatch.index + mathMatch[0].length;
        }

        if (lastMathIdx < currentText.length) {
            mathSegments.push({ type: 'text', content: currentText.substring(lastMathIdx), key: `math-text-end-${lineIndex}-${keyCounter++}` });
        }

        if (mathSegments.length === 0) {
            // No math found, treat the whole text as a single segment
            mathSegments.push({ type: 'text', content: currentText, key: `full-text-${lineIndex}-${keyCounter++}` });
        }

        // Process each segment for bolding and links
        for (const segment of mathSegments) {
            if (segment.type === 'math') {
                parts.push(
                    <span key={segment.key} className="font-serif italic text-blue-800 bg-blue-50/50 px-0.5 rounded">
                        {segment.content}
                    </span>
                );
            } else {
                // 2. Handle Bold (**...**) within the text segment
                const boldRegex = /\*\*(.+?)\*\*/g;
                let lastBoldIdx = 0;
                let boldMatch;
                const segmentText = segment.content;

                while ((boldMatch = boldRegex.exec(segmentText)) !== null) {
                    if (boldMatch.index > lastBoldIdx) {
                        const textPart = segmentText.substring(lastBoldIdx, boldMatch.index);
                        parts.push(...renderLinks(textPart, `text-${lineIndex}-${keyCounter++}`));
                    }
                    parts.push(
                        <strong key={`bold-${lineIndex}-${keyCounter++}`} className="font-semibold text-foreground">
                            {formatInline(boldMatch[1], `bold-inner-${lineIndex}-${keyCounter}`)}
                        </strong>
                    );
                    lastBoldIdx = boldMatch.index + boldMatch[0].length;
                }

                if (lastBoldIdx < segmentText.length) {
                    const textPart = segmentText.substring(lastBoldIdx);
                    parts.push(...renderLinks(textPart, `text-end-${lineIndex}-${keyCounter++}`));
                }
            }
        }

        return parts.length > 0 ? parts : [currentText]; // Return an array of elements or the original text wrapped in an array
    };

    // Helper to render links [text](url)
    const renderLinks = (text: string, baseKey: string) => {
        const linkParts: (string | JSX.Element)[] = [];
        const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
        let lastIdx = 0;
        let match;
        let counter = 0;

        while ((match = linkRegex.exec(text)) !== null) {
            if (match.index > lastIdx) {
                linkParts.push(text.substring(lastIdx, match.index));
            }

            const linkText = match[1];
            const linkUrl = match[2];

            linkParts.push(
                <a
                    key={`${baseKey}-link-${counter++}`}
                    href={linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline font-medium break-all"
                >
                    {linkText}
                </a>
            );
            lastIdx = match.index + match[0].length;
        }

        if (lastIdx < text.length) {
            linkParts.push(text.substring(lastIdx));
        }

        return linkParts;
    };

    let i = 0;
    while (i < lines.length) {
        const line = lines[i].trim();

        // 0. Detect Code Blocks (```)
        if (line.startsWith('```')) {
            const lang = line.slice(3).trim();
            const codeLines: string[] = [];
            let j = i + 1;
            while (j < lines.length && !lines[j].trim().startsWith('```')) {
                codeLines.push(lines[j]);
                j++;
            }
            const isLatex = lang.toLowerCase() === 'latex';
            elements.push(
                <div key={`code-${i}`} className={cn("my-4 relative group", isLatex && "bg-blue-50/30 rounded-xl border-blue-100 shadow-sm")}>
                    <div className={cn(
                        "absolute top-0 right-0 px-2 py-1 text-[10px] font-mono text-muted-foreground bg-muted/50 rounded-bl rounded-tr-lg uppercase tracking-wider",
                        isLatex && "bg-blue-100/50 text-blue-600"
                    )}>
                        {lang || 'code'}
                    </div>
                    <pre className={cn(
                        "p-4 bg-muted/40 rounded-lg border border-border overflow-x-auto text-xs font-mono leading-relaxed",
                        isLatex && "bg-transparent border-none text-center italic text-blue-900 overflow-x-visible whitespace-pre-wrap select-all font-serif italic text-base"
                    )}>
                        <code>{codeLines.join('\n')}</code>
                    </pre>
                </div>
            );
            i = j + 1;
            continue;
        }

        // 1. Detect Tables (| col | col ...)
        // More lenient detection: line starts with | or contains at least two pipes
        const isTableLine = (str: string) => str.trim().startsWith('|') || (str.split('|').length > 2);

        if (isTableLine(line)) {
            const tableRows: string[][] = [];
            let j = i;

            while (j < lines.length) {
                const rawLine = lines[j].trim();
                if (!isTableLine(rawLine)) break;

                // Skip separator lines (| --- | --- | or --- | ---)
                // Also skip lines that are just dashes/colon inside pipes
                if (rawLine.match(/^[|\s\-:.]+$/)) {
                    j++;
                    continue;
                }

                let cells = rawLine.split('|');
                // Remove first and last empty elements if they exist (standard |cell| format)
                if (cells[0] === '') cells.shift();
                if (cells[cells.length - 1] === '') cells.pop();

                if (cells.length > 0) {
                    tableRows.push(cells.map(c => c.trim()));
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
                                        <th key={`th-${idx}`} className="p-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
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
                i = j;
                continue;
            }
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

        /* 2.5 Detect Task List Items (Standard or Escaped)
        // We match both `[ ]` and `\[ ]` because some models might escape them, 
        // and we want to render them as checkboxes regardless.
        const taskMatch = line.match(/^(\s*)([\-\*])\s+\\?\[([ xX])\\?\](.*)/);
        if (taskMatch) {
            const [, indent, bulletChar, checkState, contentRaw] = taskMatch;
            const content = contentRaw.trim();
            const isChecked = checkState.toLowerCase() === 'x';
            elements.push(
                <div key={`task-${i}`} className="flex items-start gap-2 ml-4">
                    <span className="mt-1 flex-shrink-0 inline-flex items-center justify-center">
                        {isChecked ? (
                            <span className="w-4 h-4 rounded border border-blue-500 bg-blue-500 flex items-center justify-center text-[10px] text-white font-bold">✓</span>
                        ) : (
                            <span className="w-4 h-4 rounded border border-muted-foreground/40 bg-muted/20 flex items-center justify-center" />
                        )}
                    </span>
                    <div className="flex-1 whitespace-pre-wrap leading-relaxed text-foreground/90">
                        {formatInline(content, `task-${i}`)}
                    </div>
                </div>
            );
            i++;
            continue;
        } */
        // 3. Detect Bullet Points
        const bulletMatch = line.match(/^(\s*)([\*\-\•])(\s+)(.*)/);
        if (bulletMatch) {
            const [, indent, bullet, space, content] = bulletMatch;
            elements.push(
                <div key={`bullet-${i}`} className="flex items-start gap-2 ml-4">
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
            elements.push(<div key={`empty-${i}`} className="h-4" />);
        } else {
            // General cleanup of escapes for display (e.g. \[ -> [) if not handled above
            const displayLine = lines[i].replace(/\\([\[\]\-\*])/g, '$1');
            elements.push(
                <div key={`p-${i}`} className="whitespace-pre-wrap leading-relaxed text-foreground/90">
                    {formatInline(displayLine, `p-${i}`)}
                </div>
            );
        }
        i++;
    }

    return (
        <div className={`formatted-message text-sm ${className}`}>
            {elements}
        </div>
    );
}
