import { Router } from "express";
import { z } from "zod";
import type { CompileRequest } from "../types";
import { runCompilePrompt } from "../services/llm";
import { createDocxFromText } from "../services/compileDoc";
import fetch from "node-fetch";

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
		// Forward a provider esterno se definito
		const external = process.env.EXTERNAL_API_BASE;
		if (external) {
			const url = `${external.replace(/\/+$/, "")}/api/compile`;
			const r = await fetch(url, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(parsed.data),
			});
			if (!r.ok) {
				const t = await r.text();
				return res.status(502).json({ error: "Upstream compile error", details: t.slice(0, 2000) });
			}
			// Se upstream restituisce binario DOCX, inoltra
			const contentType = r.headers.get("content-type") || "";
			if (contentType.includes("application/vnd.openxmlformats-officedocument.wordprocessingml.document")) {
				const buf = Buffer.from(await r.arrayBuffer());
				res.setHeader("Content-Type", contentType);
				const filename =
					(parsed.data.template?.name?.replace(/\.[^/.]+$/, "") || "documento_compilato") + ".docx";
				res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
				return res.send(buf);
			}
			const j = (await r.json()) as any;
			const compiledText = j.compiledText || j.text || j.output || JSON.stringify(j);
			const outputFormat = parsed.data.outputFormat || j.format || "docx";
			if (outputFormat === "docx") {
				const buf = await createDocxFromText(compiledText);
				const filename =
					(parsed.data.template?.name?.replace(/\.[^/.]+$/, "") || "documento_compilato") + ".docx";
				res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
				res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
				return res.send(buf);
			}
			return res.json({ compiledText, format: outputFormat });
		}
		// Fallback: provider interno (OpenAI/Vertex)
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

