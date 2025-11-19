import type { ExtractedDocument } from "../types";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import Tesseract from "tesseract.js";

function guessKind(mime: string, filename: string): ExtractedDocument["sourceKind"] {
	if (mime === "application/pdf" || filename.toLowerCase().endsWith(".pdf")) return "pdf";
	if (
		mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
		filename.toLowerCase().endsWith(".docx")
	)
		return "docx";
	if (
		mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
		mime === "application/vnd.ms-excel" ||
		filename.toLowerCase().endsWith(".xlsx") ||
		filename.toLowerCase().endsWith(".xls")
	)
		return "xlsx";
	if (mime.startsWith("image/")) return "image";
	if (mime.startsWith("text/")) return "plain";
	return "unknown";
}

export async function extractTextFromFile(
	file: Express.Multer.File,
): Promise<ExtractedDocument> {
	const kind = guessKind(file.mimetype, file.originalname);
	const base: Omit<ExtractedDocument, "text" | "sourceKind"> = {
		name: file.originalname,
		mimeType: file.mimetype,
		sizeBytes: file.size,
	};

	try {
		if (kind === "pdf") {
			const parsed = await pdfParse(file.buffer);
			return {
				...base,
				sourceKind: "pdf",
				text: parsed.text || "",
				pages: parsed.numpages,
			};
		}
		if (kind === "docx") {
			const result = await mammoth.extractRawText({ buffer: file.buffer });
			return {
				...base,
				sourceKind: "docx",
				text: result.value || "",
			};
		}
		if (kind === "xlsx") {
			const workbook = XLSX.read(file.buffer, { type: "buffer" });
			const sheetNames = workbook.SheetNames;
			let text = "";
			for (const sheetName of sheetNames) {
				const sheet = workbook.Sheets[sheetName];
				if (!sheet) continue;
				const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as Array<
					Array<unknown>
				>;
				text += `\n# Foglio: ${sheetName}\n`;
				for (const row of rows) {
					text += row.map((cell) => (cell == null ? "" : String(cell))).join("\t") + "\n";
				}
			}
			return {
				...base,
				sourceKind: "xlsx",
				text,
				worksheetNames: sheetNames,
			};
		}
		if (kind === "image") {
			const langs = process.env.OCR_LANGS || "eng+ita";
			const result = await Tesseract.recognize(file.buffer, langs);
			return {
				...base,
				sourceKind: "image",
				text: result.data.text || "",
			};
		}
		// fallback for plain/unknown: treat buffer as utf-8 text
		const text = file.buffer.toString("utf-8");
		return {
			...base,
			sourceKind: kind === "plain" ? "plain" : "unknown",
			text,
		};
	} catch (err) {
		return {
			...base,
			sourceKind: kind,
			text: "",
		};
	}
}

