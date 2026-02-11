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

    // Helper to format inline text (bold **...** and math $...$)
    const formatInline = (text: string, lineIndex: number | string) => {
        const parts: (string | JSX.Element)[] = [];
        let currentText = text;
        let keyCounter = 0;

        // 1. Handle Inline Math ($...$)
        // We look for $...$ but avoid matching if it looks like currency (e.g. $100) - simple check: space after opening $
        // Better regex: \$([^$]+)\$ matches content between $ signs. 
        // We use a specific regex to avoid matching currency like $50. Context matters.
        // For simplicity in this context, we assume $...$ is math if not followed by a digit immediately or if clearly paired.
        // Let's stick to the previous regex but use KaTeX for rendering.
        const mathRegex = /\$([^$]+)\$/g;
        let lastMathIdx = 0;
        let mathMatch;
        let mathCounter = 0;

        // Collect math parts first
        const mathSegments: { type: 'text' | 'math', content: string, key: string }[] = [];
        while ((mathMatch = mathRegex.exec(currentText)) !== null) {
            // Simple heuristic to avoid currency: if capture group starts with a digit and has no spaces, ignore? 
            // Only strictly if user typed $100. But $E=mc^2$ works. 
            // Let's rely on KaTeX to throw or render.
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
                try {
                    const html = katex.renderToString(segment.content, {
                        throwOnError: false,
                        displayMode: false
                    });
                    parts.push(
                        <span
                            key={segment.key}
                            dangerouslySetInnerHTML={{ __html: html }}
                            className="inline-math"
                        />
                    );
                } catch (e) {
                    // Fallback if KaTeX fails
                    parts.push(
                        <span key={segment.key} className="font-serif italic text-blue-800 bg-blue-50/50 px-0.5 rounded">
                            ${segment.content}$
                        </span>
                    );
                }
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

        // 0. Detect Code Blocks (```) or Math Blocks ($$)
        // We treat ```latex as math block now, and also support $$ ... $$ if found on one line or multiline
        if (line.startsWith('```')) {
            const lang = line.slice(3).trim().toLowerCase();
            const codeLines: string[] = [];
            let j = i + 1;
            while (j < lines.length && !lines[j].trim().startsWith('```')) {
                codeLines.push(lines[j]);
                j++;
            }

            const isLatex = lang === 'latex' || lang === 'tex';
            // Also check for 'math' language just in case
            const isMath = isLatex || lang === 'math';

            if (isMath) {
                const latexContent = codeLines.join('\n');
                try {
                    const html = katex.renderToString(latexContent, {
                        throwOnError: false,
                        displayMode: true
                    });
                    elements.push(
                        <div key={`math-block-${i}`} className="my-4 overflow-x-auto p-4 flex justify-center bg-gray-50/50 rounded-lg border border-gray-100/50" dangerouslySetInnerHTML={{ __html: html }} />
                    );
                } catch (e) {
                    // Fallback
                    elements.push(
                        <div key={`code-${i}`} className={cn("my-4 relative group bg-blue-50/30 rounded-xl border-blue-100 shadow-sm")}>
                            <pre className="p-4 bg-transparent border-none text-center italic text-blue-900 overflow-x-visible whitespace-pre-wrap select-all font-serif italic text-base">
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

        // Detect explicit display math $$ ... $$
        if (line.startsWith('$$') && line.endsWith('$$') && line.length > 4) {
            const mathContent = line.slice(2, -2).trim();
            try {
                const html = katex.renderToString(mathContent, {
                    throwOnError: false,
                    displayMode: true
                });
                elements.push(
                    <div key={`display-math-${i}`} className="my-4 overflow-x-auto p-4 flex justify-center" dangerouslySetInnerHTML={{ __html: html }} />
                );
                i++;
                continue;
            } catch (e) {
                // ignore, fallback to text
            }
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
