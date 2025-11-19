import { Router } from "express";
import fetch from "node-fetch";
import { z } from "zod";

export const integrationsRouter = Router();

// In-memory store (sostituibile con segreti GCP/DB)
let excelCredentials: { headerName?: string; apiKey?: string } = {};

integrationsRouter.post(
	"/excel/credentials",
	(req, res) => {
		const schema = z.object({
			headerName: z.string().optional(),
			apiKey: z.string().optional(),
		});
		const parsed = schema.safeParse(req.body);
		if (!parsed.success) {
			return res.status(400).json({ error: parsed.error.flatten() });
		}
		excelCredentials = { ...excelCredentials, ...parsed.data };
		return res.json({ ok: true });
	},
);

integrationsRouter.post("/excel/fetch", async (req, res) => {
	const schema = z.object({
		url: z.string().url(),
		extraHeaders: z.record(z.string()).optional(),
	});
	const parsed = schema.safeParse(req.body);
	if (!parsed.success) {
		return res.status(400).json({ error: parsed.error.flatten() });
	}
	try {
		const headers: Record<string, string> = {
			...(parsed.data.extraHeaders || {}),
		};
		if (excelCredentials.apiKey && excelCredentials.headerName) {
			headers[excelCredentials.headerName] = excelCredentials.apiKey;
		}
		const resp = await fetch(parsed.data.url, { headers });
		if (!resp.ok) {
			return res.status(resp.status).json({ error: `Remote status ${resp.status}` });
		}
		const contentType = resp.headers.get("content-type") || "application/octet-stream";
		const arrayBuffer = await resp.arrayBuffer();
		const buf = Buffer.from(arrayBuffer);
		const base64 = buf.toString("base64");
		return res.json({ contentType, base64 });
	} catch (err) {
		return res.status(500).json({ error: "Errore fetch remoto Excel" });
	}
});

