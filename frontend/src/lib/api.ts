// Backend base URL (solo per /api/analyze e /api/compile)
const SERVER_URL =
	import.meta.env.VITE_SERVER_URL || "https://compilator-346681848489.europe-west1.run.app";

export async function uploadAndExtract(files: File[]) {
	// Estrazione client-side (no backend)
	async function guessKind(mime: string, name: string) {
		if (mime === "application/pdf" || name.toLowerCase().endsWith(".pdf")) return "pdf";
		if (
			mime ===
				"application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
			name.toLowerCase().endsWith(".docx")
		)
			return "docx";
		if (
			mime ===
				"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
			mime === "application/vnd.ms-excel" ||
			name.toLowerCase().endsWith(".xlsx") ||
			name.toLowerCase().endsWith(".xls")
		)
			return "xlsx";
		if (mime.startsWith("image/")) return "image";
		if (mime.startsWith("text/")) return "plain";
		return "unknown";
	}

	async function extractPdf(file: File): Promise<string> {
		// pdf.js in browser; worker da CDN per semplicità
		// @ts-expect-error dynamic import no types
		const pdfjs = await import("pdfjs-dist/build/pdf");
		// @ts-expect-error missing types
		pdfjs.GlobalWorkerOptions.workerSrc =
			"https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
		const data = await file.arrayBuffer();
		const pdf = await pdfjs.getDocument({ data }).promise;
		let text = "";
		for (let p = 1; p <= pdf.numPages; p++) {
			const page = await pdf.getPage(p);
			// @ts-expect-error textContent type
			const content = await page.getTextContent();
			const strings = content.items.map((it: any) => it.str).join(" ");
			text += (p > 1 ? "\n\n" : "") + strings;
		}
		return text;
	}

	async function extractDocx(file: File): Promise<string> {
		// @ts-expect-error dynamic import
		const mammoth = await import("mammoth");
		const arrayBuffer = await file.arrayBuffer();
		const res = await mammoth.extractRawText({ arrayBuffer });
		return res.value || "";
	}

	async function extractXlsx(file: File): Promise<string> {
		// @ts-expect-error dynamic import
		const XLSX = await import("xlsx");
		const data = new Uint8Array(await file.arrayBuffer());
		const wb = XLSX.read(data, { type: "array" });
		let text = "";
		for (const sheetName of wb.SheetNames) {
			const sheet = wb.Sheets[sheetName];
			if (!sheet) continue;
			const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as Array<Array<unknown>>;
			text += `\n# Foglio: ${sheetName}\n`;
			for (const row of rows) {
				text += row.map((c) => (c == null ? "" : String(c))).join("\t") + "\n";
			}
		}
		return text.trim();
	}

	async function extractImageOcr(file: File): Promise<string> {
		// @ts-expect-error dynamic import default
		const Tesseract = (await import("tesseract.js")).default;
		const result = await Tesseract.recognize(file, "eng+ita");
		return result.data?.text || "";
	}

	async function extractOne(file: File) {
		const kind = await guessKind(file.type || "", file.name || "file");
		let text = "";
		try {
			if (kind === "pdf") text = await extractPdf(file);
			else if (kind === "docx") text = await extractDocx(file);
			else if (kind === "xlsx") text = await extractXlsx(file);
			else if (kind === "image") text = await extractImageOcr(file);
			else text = await file.text();
		} catch {
			// fallback: prova come testo
			try {
				text = await file.text();
			} catch {
				text = "";
			}
		}
		return {
			name: file.name,
			mimeType: file.type || "",
			sizeBytes: file.size,
			text,
			sourceKind: (kind as any) || "unknown",
		};
	}

	const documents = await Promise.all(files.slice(0, 10).map(extractOne));
	return { documents };
}

export async function analyzeDocuments(body: {
	task?: string;
	documents: Array<{ name: string; text: string }>;
}) {
	const resp = await fetch(`${SERVER_URL}/api/analyze`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	if (!resp.ok) throw new Error("Errore analisi");
	return (await resp.json()) as { resultText: string };
}

export async function compileDocument(body: {
	instructions?: string;
	template?: { name: string; text: string } | null;
	sources: Array<{ name: string; text: string }>;
	outputFormat?: "docx" | "markdown" | "text";
}) {
	// Se output docx, server risponde binario
	if (!body.outputFormat || body.outputFormat === "docx") {
		const resp = await fetch(`${SERVER_URL}/api/compile`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
		if (!resp.ok) throw new Error("Errore compilazione");
		const blob = await resp.blob();
		return { blob, contentType: resp.headers.get("content-type") || "application/octet-stream" };
	}
	const resp = await fetch(`${SERVER_URL}/api/compile`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	if (!resp.ok) throw new Error("Errore compilazione");
	return (await resp.json()) as { compiledText: string; format: string };
}

export async function setExcelCredentials(body: { headerName?: string; apiKey?: string }) {
	const resp = await fetch(`${SERVER_URL}/api/integrations/excel/credentials`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	if (!resp.ok) throw new Error("Errore salvataggio credenziali");
	return (await resp.json()) as { ok: true };
}

export async function fetchExcelFileByUrl(body: { url: string; extraHeaders?: Record<string, string> }) {
	const resp = await fetch(`${SERVER_URL}/api/integrations/excel/fetch`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	if (!resp.ok) throw new Error("Errore fetch remoto");
	return (await resp.json()) as { contentType: string; base64: string };
}

