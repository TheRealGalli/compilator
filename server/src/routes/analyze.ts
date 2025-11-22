import { Router } from "express";
import { z } from "zod";
import type { AnalyzeRequest } from "../types";
import { runAnalysisPrompt } from "../services/llm";
import fetch from "node-fetch";

export const analyzeRouter = Router();

const analyzeSchema = z.object({
	task: z.string().optional(),
	documents: z
		.array(z.object({ name: z.string(), text: z.string() }))
		.max(10, "Massimo 10 documenti"),
}) satisfies z.ZodType<AnalyzeRequest>;

analyzeRouter.post("/", async (req, res) => {
	const parsed = analyzeSchema.safeParse(req.body);
	if (!parsed.success) {
		return res.status(400).json({ error: parsed.error.flatten() });
	}
	try {
		// Forward a provider esterno se definito
		const external = process.env.EXTERNAL_API_BASE;
		if (external) {
			const url = `${external.replace(/\/+$/, "")}/api/analyze`;
			const r = await fetch(url, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(parsed.data),
			});
			if (!r.ok) {
				const t = await r.text();
				return res.status(502).json({ error: "Upstream analyze error", details: t.slice(0, 2000) });
			}
			const j = (await r.json()) as any;
			// normalizza in { resultText }
			const resultText = j.resultText || j.text || j.output || JSON.stringify(j);
			return res.json({ resultText });
		}
		// Fallback: provider interno (OpenAI/Vertex)
		const result = await runAnalysisPrompt({
			task: parsed.data.task || "Analizza i documenti",
			documents: parsed.data.documents,
		});
		return res.json({ resultText: result.text });
	} catch (err) {
		return res.status(500).json({ error: "Errore durante l'analisi con LLM" });
	}
});

