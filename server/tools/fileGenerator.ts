import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, TableLayoutType } from 'docx';
import fs from 'fs';
import path from 'path';

/**
 * Helper to parse inline formatting (like **bold** and [x]/[ ]) 
 * for backend DOCX generation.
 */
function parseInline(text: string, options: { size?: number, color?: string, bold?: boolean } = {}) {
    // Unescape markdown first
    const unescaped = text.replace(/\\([#*_\[\]\-|])/g, '$1');
    const boldRegex = /\*\*(.+?)\*\*/g;
    const runs: any[] = [];
    let lastIndex = 0;
    let match;

    while ((match = boldRegex.exec(unescaped)) !== null) {
        if (match.index > lastIndex) {
            runs.push(new TextRun({
                text: unescaped.substring(lastIndex, match.index),
                size: options.size || 24,
                bold: options.bold || false
            }));
        }
        runs.push(new TextRun({
            text: match[1],
            bold: true,
            size: options.size || 24
        }));
        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < unescaped.length) {
        runs.push(new TextRun({
            text: unescaped.substring(lastIndex),
            size: options.size || 24,
            bold: options.bold || false
        }));
    }

    return runs.length > 0 ? runs : [new TextRun({ text: unescaped, size: options.size || 24, bold: options.bold || false })];
}

/**
 * Generates a PDF file from text content.
 */
export async function generatePDF(content: string, filename: string): Promise<string> {
    console.log(`[FileGen] Starting PDF generation for ${filename}...`);
    const start = Date.now();
    return new Promise((resolve, reject) => {
        try {
            const PDFDocument = require('pdfkit');
            const doc = new PDFDocument();
            const safeFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
            const filePath = path.join('/tmp', safeFilename);
            const stream = fs.createWriteStream(filePath);

            doc.pipe(stream);
            doc.fontSize(12).text(content, {
                align: 'left'
            });
            doc.end();

            stream.on('finish', () => {
                console.log(`[FileGen] PDF generated in ${Date.now() - start}ms: ${filePath}`);
                resolve(filePath);
            });
            stream.on('error', (err: any) => {
                console.error('[FileGen] PDF Generation Error:', err);
                reject(err);
            });
        } catch (error) {
            console.error('[FileGen] PDF Sync Error:', error);
            reject(error);
        }
    });
}

/**
 * Generates a DOCX file from text content with full markdown support for tables and formatting.
 */
export async function generateDOCX(content: string, filename: string): Promise<string> {
    console.log(`[FileGen] Starting DOCX generation with Markdown support for ${filename}...`);
    const start = Date.now();
    const safeFilename = filename.endsWith('.docx') ? filename : `${filename}.docx`;
    const filePath = path.join('/tmp', safeFilename);

    const lines = content.split('\n');
    const docChildren: any[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) {
            docChildren.push(new Paragraph({ text: "" }));
            continue;
        }

        // 1. Table Detection
        const isTableLine = (str: string) => str.trim().startsWith('|') || (str.split('|').length > 2);

        if (isTableLine(line)) {
            const tableRowsData: string[][] = [];
            let j = i;

            while (j < lines.length && isTableLine(lines[j])) {
                const rowLine = lines[j].trim();
                if (rowLine.match(/^[|\s\-:.]+$/)) {
                    j++;
                    continue;
                }

                let cells = rowLine.split('|');
                if (cells[0] === '') cells.shift();
                if (cells[cells.length - 1] === '') cells.pop();

                if (cells.length > 0) {
                    tableRowsData.push(cells.map(c => c.trim()));
                }
                j++;
            }

            if (tableRowsData.length > 0) {
                const maxCols = Math.max(...tableRowsData.map(r => r.length));
                const baseWidth = 9070;
                const cellWidth = Math.floor(baseWidth / maxCols);

                const tableRows = tableRowsData.map((row, rowIndex) => {
                    const isHeader = rowIndex === 0;
                    const standardRow = [...row];
                    while (standardRow.length < maxCols) standardRow.push("");

                    return new TableRow({
                        children: standardRow.map(cellText => new TableCell({
                            children: [new Paragraph({
                                children: parseInline(cellText, { size: 22, bold: isHeader }),
                                alignment: AlignmentType.LEFT
                            })],
                            width: { size: cellWidth, type: WidthType.DXA },
                            shading: isHeader ? { fill: "F3F4F6" } : undefined,
                            margins: { top: 100, bottom: 100, left: 100, right: 100 },
                        }))
                    });
                });

                docChildren.push(new Table({
                    rows: tableRows,
                    width: { size: baseWidth, type: WidthType.DXA },
                    columnWidths: Array(maxCols).fill(cellWidth),
                    layout: TableLayoutType.FIXED,
                }));

                i = j - 1;
                continue;
            }
        }

        // 2. Headers
        if (line.startsWith('# ')) {
            docChildren.push(new Paragraph({
                children: parseInline(line.substring(2), { size: 36, bold: true }),
                spacing: { before: 400, after: 200 }
            }));
        } else if (line.startsWith('## ')) {
            docChildren.push(new Paragraph({
                children: parseInline(line.substring(3), { size: 30, bold: true }),
                spacing: { before: 300, after: 150 }
            }));
        } else if (line.startsWith('### ')) {
            docChildren.push(new Paragraph({
                children: parseInline(line.substring(4), { size: 27, bold: true }),
                spacing: { before: 200, after: 100 }
            }));
        }
        // 3. Bullets
        else if (line.startsWith('- ') || line.startsWith('* ') || line.match(/^\d+\. /)) {
            const isNumbered = line.match(/^\d+\. /);
            const textContent = isNumbered ? line.replace(/^\d+\. /, '') : line.substring(2);

            docChildren.push(new Paragraph({
                children: parseInline(textContent),
                bullet: isNumbered ? undefined : { level: 0 },
                spacing: { after: 120 }
            }));
        }
        // 4. Standard Paragraph
        else {
            docChildren.push(new Paragraph({
                children: parseInline(line),
                spacing: { after: 120 }
            }));
        }
    }

    const doc = new Document({
        styles: {
            default: {
                document: {
                    run: {
                        font: "Arial",
                        size: 24,
                    }
                }
            }
        },
        sections: [{
            properties: {},
            children: docChildren,
        }],
    });

    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(filePath, buffer);
    console.log(`[FileGen] Optimized DOCX generated in ${Date.now() - start}ms: ${filePath}`);
    return filePath;
}

/**
 * Generates a Markdown file.
 */
export async function generateMD(content: string, filename: string): Promise<string> {
    const start = Date.now();
    const safeFilename = filename.endsWith('.md') ? filename : `${filename}.md`;
    const filePath = path.join('/tmp', safeFilename);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`[FileGen] MD generated in ${Date.now() - start}ms: ${filePath}`);
    return filePath;
}

/**
 * Generates a JSONL file.
 */
export async function generateJSONL(data: string, filename: string): Promise<string> {
    const start = Date.now();
    const safeFilename = filename.endsWith('.jsonl') ? filename : `${filename}.jsonl`;
    const filePath = path.join('/tmp', safeFilename);
    // Ensure data is string; acts as a pass-through if the model formatted it well
    fs.writeFileSync(filePath, data, 'utf8');
    console.log(`[FileGen] JSONL generated in ${Date.now() - start}ms: ${filePath}`);
    return filePath;
}
