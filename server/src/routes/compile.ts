import { Router } from "express";
import { z } from "zod";
import type { CompileRequest } from "../types";
import { runCompilePrompt } from "../services/llm";
import { createDocxFromText } from "../services/compileDoc";

export const compileRouter = Router();

const compileSchema = z.object({
	instructions: z.string().optional(),
	template: z.object({ name: z.string(), text: z.string() }).nullable().optional(),
	sources: z
		.array(z.object({ name: z.string(), text: z.string() }))
		.min(1)
		.max(9, "Massimo 9 fonti"),
	outputFormat: z.enum(["docx", "markdown", "text"]).optional(),
}) satisfies z.ZodType<CompileRequest>;

compileRouter.post("/", async (req, res) => {
	const parsed = compileSchema.safeParse(req.body);
	if (!parsed.success) {
		return res.status(400).json({ error: parsed.error.flatten() });
	}
	try {
		const result = await runCompilePrompt({
			instructions: parsed.data.instructions || "Compila il documento",
			template: parsed.data.template || null,
			sources: parsed.data.sources,
			outputFormat: parsed.data.outputFormat || "docx",
		});

		const outputFormat = parsed.data.outputFormat || "docx";
		if (outputFormat === "docx") {
			const buf = await createDocxFromText(result.text);
			const filename =
				(parsed.data.template?.name?.replace(/\.[^/.]+$/, "") || "documento_compilato") +
				".docx";
			res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
			res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
			return res.send(buf);
		}
		return res.json({ compiledText: result.text, format: outputFormat });
	} catch (err) {
		return res.status(500).json({ error: "Errore durante la compilazione con LLM" });
	}
});

