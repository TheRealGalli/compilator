import PDFDocument from 'pdfkit';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import fs from 'fs';
import path from 'path';

/**
 * Generates a PDF file from text content.
 */
export async function generatePDF(content: string, filename: string): Promise<string> {
    console.log(`[FileGen] Starting PDF generation for ${filename}...`);
    const start = Date.now();
    return new Promise((resolve, reject) => {
        try {
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
            stream.on('error', (err) => {
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
 * Generates a DOCX file from text content.
 */
export async function generateDOCX(content: string, filename: string): Promise<string> {
    console.log(`[FileGen] Starting DOCX generation for ${filename}...`);
    const start = Date.now();
    const safeFilename = filename.endsWith('.docx') ? filename : `${filename}.docx`;
    const filePath = path.join('/tmp', safeFilename);

    // Split content by newlines to create paragraphs
    const paragraphs = content.split('\n').map(line => new Paragraph({
        children: [new TextRun(line)],
    }));

    const doc = new Document({
        sections: [{
            properties: {},
            children: paragraphs,
        }],
    });

    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(filePath, buffer);
    console.log(`[FileGen] DOCX generated in ${Date.now() - start}ms: ${filePath}`);
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
