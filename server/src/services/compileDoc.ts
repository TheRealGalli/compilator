import { Document, Packer, Paragraph, TextRun } from "docx";

export async function createDocxFromText(text: string): Promise<Buffer> {
	const lines = text.split(/\r?\n/);
	const paragraphs = lines.map(
		(line) =>
			new Paragraph({
				children: [new TextRun({ text: line })],
			}),
	);
	const doc = new Document({
		sections: [{ properties: {}, children: paragraphs }],
	});
	const arrayBuffer = await Packer.toBuffer(doc);
	return arrayBuffer;
}

