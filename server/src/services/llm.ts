import OpenAI from "openai";
import { VertexAI } from "@google-cloud/vertexai";

type AnalyzeInput = {
	task: string;
	documents: Array<{ name: string; text: string }>;
	model?: string;
};

type CompileInput = {
	instructions: string;
	template?: { name: string; text: string } | null;
	sources: Array<{ name: string; text: string }>;
	outputFormat?: "docx" | "markdown" | "text";
	model?: string;
};

function getProvider(): "vertex" | "openai" {
	const p = (process.env.LLM_PROVIDER || "").toLowerCase();
	return p === "vertex" || p === "gemini" ? "vertex" : "openai";
}

async function generateWithOpenAI(prompt: string, model?: string): Promise<string> {
	const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
	const m = model || process.env.OPENAI_MODEL || "gpt-4o-mini";
	const res = await client.responses.create({ model: m, input: prompt });
	const text =
		res.output_text ||
		(res.content?.[0] && "text" in res.content[0] ? (res.content[0] as any).text : "");
	return text || "";
}

async function generateWithVertex(prompt: string, model?: string): Promise<string> {
	const project = process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
	const location = process.env.GCP_LOCATION || "us-central1";
	if (!project) {
		throw new Error("GCP_PROJECT (o GOOGLE_CLOUD_PROJECT) non impostato");
	}
	const modelId = model || process.env.VERTEX_MODEL || "gemini-1.5-pro";
	const vertexAI = new VertexAI({ project, location });
	const generativeModel = vertexAI.getGenerativeModel({ model: modelId });
	const resp = await generativeModel.generateContent({
		contents: [{ role: "user", parts: [{ text: prompt }] }],
	});
	const parts = resp.response?.candidates?.[0]?.content?.parts || [];
	const text = parts.map((p: any) => p.text || "").join("");
	return text || "";
}

async function generateText(prompt: string, model?: string): Promise<string> {
	const provider = getProvider();
	if (provider === "vertex") return generateWithVertex(prompt, model);
	return generateWithOpenAI(prompt, model);
}

export async function runAnalysisPrompt(input: AnalyzeInput) {
	const model = input.model;
	const prompt = [
		"Sei un analista. Riceverai fino a 10 documenti in testo estratto.",
		"Obiettivo:",
		input.task || "Riassumi contenuti, evidenzia punti chiave e incongruenze.",
		"Restituisci un output strutturato in sezioni: Riassunto, Punti Chiave, Citazioni Rilevanti, Incongruenze.",
		"",
		"Documenti:",
		...input.documents.map(
			(d, i) => `### Documento ${i + 1}: ${d.name}\n${d.text.slice(0, 6000)}`,
		),
	].join("\n");
	const text = await generateText(prompt, model);
	return { text };
}

export async function runCompilePrompt(input: CompileInput) {
	const model = input.model;
	const prompt = [
		"Sei un assistente di compilazione. Compila il documento target usando le fonti.",
		"Rispetta fedelmente la struttura del template se fornito.",
		"Se mancano dati, inserisci placeholder facilmente cercabili come [[DA COMPILARE]].",
		"",
		"ISTRUZIONI:",
		input.instructions || "Compila un documento coerente, ben formattato e completo.",
		"",
		input.template
			? `TEMPLATE (${input.template.name}):\n${input.template.text.slice(0, 12000)}`
			: "TEMPLATE: (nessuno fornito, crea una struttura adeguata)",
		"",
		"FONTI:",
		...input.sources.map(
			(s, i) => `### Fonte ${i + 1}: ${s.name}\n${s.text.slice(0, 6000)}`,
		),
		"",
		"Output richiesto: solo contenuto del documento compilato, senza spiegazioni.",
	].join("\n");
	const text = await generateText(prompt, model);
	return { text };
}


