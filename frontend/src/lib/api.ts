// Set to true to use local server, false for Cloud Run
const USE_LOCAL = false;
const SERVER_URL = import.meta.env.VITE_SERVER_URL || (USE_LOCAL ? "http://localhost:8787" : "https://compilator-346681848489.europe-west1.run.app");

export async function uploadAndExtract(files: File[]) {
	const form = new FormData();
	for (const f of files) form.append("files", f);
	const resp = await fetch(`${SERVER_URL}/api/files/extract`, {
		method: "POST",
		body: form,
	});
	if (!resp.ok) throw new Error("Errore estrazione");
	return (await resp.json()) as { documents: any[] };
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

