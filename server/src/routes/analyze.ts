import { Router } from "express";
import { z } from "zod";
import type { AnalyzeRequest } from "../types";
import { runAnalysisPrompt } from "../services/llm";

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
		const result = await runAnalysisPrompt({
			task: parsed.data.task || "Analizza i documenti",
			documents: parsed.data.documents,
		});
		return res.json({ resultText: result.text });
	} catch (err) {
		return res.status(500).json({ error: "Errore durante l'analisi con LLM" });
	}
});

