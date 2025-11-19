import OpenAI from "openai";

const client = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});

export async function runAnalysisPrompt(input: {
	model?: string;
	task: string;
	documents: Array<{ name: string; text: string }>;
}) {
	const model = input.model || process.env.OPENAI_MODEL || "gpt-4o-mini";
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

	const res = await client.responses.create({
		model,
		input: prompt,
	});
	// Extract text
	const text =
		res.output_text ||
		(res.content?.[0] && "text" in res.content[0] ? (res.content[0] as any).text : "");
	return { text };
}

export async function runCompilePrompt(input: {
	model?: string;
	instructions: string;
	template?: { name: string; text: string } | null;
	sources: Array<{ name: string; text: string }>;
	outputFormat?: "docx" | "markdown" | "text";
}) {
	const model = input.model || process.env.OPENAI_MODEL || "gpt-4o-mini";
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

	const res = await client.responses.create({
		model,
		input: prompt,
	});
	const text =
		res.output_text ||
		(res.content?.[0] && "text" in res.content[0] ? (res.content[0] as any).text : "");
	return { text };
}

