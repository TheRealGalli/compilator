import React from 'react';
import { cn } from '@/lib/utils';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface FormattedMessageProps {
    content: string;
    className?: string;
}

export function FormattedMessage({ content, className = '' }: FormattedMessageProps) {
    if (!content) return null;

    const lines = content.split('\n');
    const elements: JSX.Element[] = [];

    // Helper to format inline text (bold **...**, math $...$, links [...](...))
    const formatInline = (text: string, lineIndex: number | string) => {
        const parts: (string | JSX.Element)[] = [];
        let currentText = text;
        let keyCounter = 0;

        // 1. Handle Inline Math ($...$)
        // We look for $...$ but avoid matching if it looks like currency (e.g. $100)
        // Regex: \$([^$\n]+?)\$  -> Non-greedy match, no newlines allowed in inline math
        const mathRegex = /\$([^$\n]+?)\$/g;
        let lastMathIdx = 0;
        let mathMatch;
        let mathCounter = 0;

        // Collect parts
        const segments: { type: 'text' | 'math' | 'bold' | 'link', content: string, key: string }[] = [];

        // We process ONLY math first, because math can contain characters that look like other markdown
        while ((mathMatch = mathRegex.exec(currentText)) !== null) {
            // Check if it looks like currency: $ followed by digit
            if (mathMatch[1].match(/^\d/)) {
                continue; // Skip, treat as text
            }

            if (mathMatch.index > lastMathIdx) {
                segments.push({ type: 'text', content: currentText.substring(lastMathIdx, mathMatch.index), key: `text-pre-${lineIndex}-${keyCounter++}` });
            }
            segments.push({ type: 'math', content: mathMatch[1], key: `math-${lineIndex}-${mathCounter++}` });
            lastMathIdx = mathMatch.index + mathMatch[0].length;
        }
        if (lastMathIdx < currentText.length) {
            segments.push({ type: 'text', content: currentText.substring(lastMathIdx), key: `text-rem-${lineIndex}-${keyCounter++}` });
        }

        if (segments.length === 0) {
            segments.push({ type: 'text', content: currentText, key: `text-full-${lineIndex}-${keyCounter++}` });
        }

        // Now process text segments for Bold and Links
        for (const segment of segments) {
            if (segment.type === 'math') {
                try {
                    const html = katex.renderToString(segment.content, {
                        throwOnError: false,
                        displayMode: false
                    });
                    parts.push(
                        <span
                            key={segment.key}
                            dangerouslySetInnerHTML={{ __html: html }}
                            className="inline-math text-base mx-1"
                        />
                    );
                } catch (e) {
                    parts.push(<span key={segment.key} className="text-red-500 text-xs">${segment.content}$</span>);
                }
            } else {
                // Process Bold (**...**)
                const boldRegex = /\*\*(.+?)\*\*/g;
                let lastBoldIdx = 0;
                let boldMatch;
                const text = segment.content;

                while ((boldMatch = boldRegex.exec(text)) !== null) {
                    if (boldMatch.index > lastBoldIdx) {
                        parts.push(...renderLinks(text.substring(lastBoldIdx, boldMatch.index), `link-${lineIndex}-${keyCounter++}`));
                    }
                    parts.push(
                        <strong key={`bold-${lineIndex}-${keyCounter++}`} className="font-bold text-foreground">
                            {formatInline(boldMatch[1], `nested-${lineIndex}-${keyCounter}`)}
                        </strong>
                    );
                    lastBoldIdx = boldMatch.index + boldMatch[0].length;
                }
                if (lastBoldIdx < text.length) {
                    parts.push(...renderLinks(text.substring(lastBoldIdx), `link-end-${lineIndex}-${keyCounter++}`));
                }
            }
        }

        // Flatten if needed, or return array
        return parts.length > 0 ? parts : [currentText];
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

            linkParts.push(
                <a
                    key={`${baseKey}-${counter++}`}
                    href={match[2]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline font-medium"
                >
                    {match[1]}
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

        // 1. Detect Block Math ($$ ... $$) - Single and Multi-line
        if (line.startsWith('$$')) {
            let mathContent = '';
            let j = i;

            // Single line $$ ... $$
            if (line.endsWith('$$') && line.length > 4) {
                mathContent = line.slice(2, -2).trim();
                j = i; // same line
            } else {
                // Multi-line $$ ...
                // Collect lines until we find $$
                const blockLines: string[] = [];
                if (line.length > 2) blockLines.push(line.slice(2)); // Content after initial $$
                j++;

                while (j < lines.length) {
                    const nextLine = lines[j].trim();
                    if (nextLine.endsWith('$$')) {
                        if (nextLine.length > 2) blockLines.push(nextLine.slice(0, -2));
                        break;
                    } else if (nextLine === '$$') {
                        break;
                    }
                    blockLines.push(lines[j]); // preserve standard indentation logic if needed, but here we trim usually OK for math
                    j++;
                }
                mathContent = blockLines.join('\n');
            }

            try {
                const html = katex.renderToString(mathContent, {
                    throwOnError: false,
                    displayMode: true
                });
                elements.push(
                    <div key={`math-display-${i}`} className="my-6 overflow-x-auto flex justify-center p-2 rounded hover:bg-muted/30 transition-colors" dangerouslySetInnerHTML={{ __html: html }} />
                );
            } catch (e) {
                // Fallback detection
                elements.push(<div key={`math-error-${i}`} className="text-red-500 font-mono text-sm p-4 border border-red-200 rounded block">{mathContent}</div>);
            }
            i = j + 1;
            continue;
        }

        // 2. Detect Code Blocks (```) including ```latex
        if (line.startsWith('```')) {
            const lang = line.slice(3).trim().toLowerCase();
            const codeLines: string[] = [];
            let j = i + 1;
            while (j < lines.length && !lines[j].trim().startsWith('```')) {
                codeLines.push(lines[j]);
                j++;
            }

            const isLatex = lang === 'latex' || lang === 'tex' || lang === 'math';

            if (isLatex) {
                const latexContent = codeLines.join('\n');
                try {
                    const html = katex.renderToString(latexContent, {
                        throwOnError: false,
                        displayMode: true
                    });
                    elements.push(
                        <div key={`math-block-${i}`} className="my-6 overflow-x-auto flex justify-center p-4 bg-gray-50/50 rounded-lg border border-gray-100/50" dangerouslySetInnerHTML={{ __html: html }} />
                    );
                } catch (e) {
                    elements.push(
                        <div key={`code-${i}`} className="my-4 relative group">
                            <pre className="p-4 bg-muted/40 rounded-lg border border-border overflow-x-auto text-xs font-mono">
                                <code>{latexContent}</code>
                            </pre>
                        </div>
                    );
                }
            } else {
                elements.push(
                    <div key={`code-${i}`} className="my-4 relative group">
                        <div className="absolute top-0 right-0 px-2 py-1 text-[10px] font-mono text-muted-foreground bg-muted/50 rounded-bl rounded-tr-lg uppercase tracking-wider">
                            {lang || 'code'}
                        </div>
                        <pre className="p-4 bg-muted/40 rounded-lg border border-border overflow-x-auto text-xs font-mono leading-relaxed">
                            <code>{codeLines.join('\n')}</code>
                        </pre>
                    </div>
                );
            }
            i = j + 1;
            continue;
        }

        // 3. Tables
        const isTableLine = (str: string) => str.trim().startsWith('|') || (str.split('|').length > 2);
        if (isTableLine(line)) {
            const tableRows: string[][] = [];
            let j = i;
            while (j < lines.length) {
                const rawLine = lines[j].trim();
                if (!isTableLine(rawLine)) break;
                if (rawLine.match(/^[|\s\-:.]+$/)) { j++; continue; }

                let cells = rawLine.split('|');
                if (cells[0] === '') cells.shift();
                if (cells[cells.length - 1] === '') cells.pop();

                if (cells.length > 0) tableRows.push(cells.map(c => c.trim()));
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
                                            <td key={`td-${colIdx}`} className="p-3 text-sm min-w-[100px]">
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

        // 4. Headers
        const headerMatch = line.match(/^(#{1,6})\s+(.*)/);
        if (headerMatch) {
            const [, hashes, title] = headerMatch;
            const level = hashes.length;
            const sizeClass = level === 1 ? "text-2xl font-bold mt-8 mb-4 border-b border-border pb-2" :
                level === 2 ? "text-xl font-bold mt-6 mb-3 border-b border-border/50 pb-1" :
                    "text-lg font-bold mt-5 mb-2";
            elements.push(
                <div key={`header-${i}`} className={`${sizeClass} text-foreground`}>
                    {formatInline(title, `header-${i}`)}
                </div>
            );
            i++;
            continue;
        }

        // 5. Bullets
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

        // 6. Regular Paragraphs
        if (line === '') {
            elements.push(<div key={`empty-${i}`} className="h-4" />);
        } else {
            const displayLine = lines[i].replace(/\\([\[\]\-\*])/g, '$1');
            elements.push(
                <div key={`p-${i}`} className="whitespace-pre-wrap leading-relaxed text-foreground/90 min-h-[1.5em]">
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
