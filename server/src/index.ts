import "dotenv/config";
import express from "express";
import cors from "cors";
import { filesRouter } from "./routes/files";
import { analyzeRouter } from "./routes/analyze";
import { compileRouter } from "./routes/compile";
import { integrationsRouter } from "./routes/integrations";

const app = express();

app.use(
	cors({
		origin: process.env.CORS_ORIGIN || "*",
	}),
);
app.use(express.json({ limit: "10mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/files", filesRouter);
app.use("/api/analyze", analyzeRouter);
app.use("/api/compile", compileRouter);
app.use("/api/integrations", integrationsRouter);

const port = Number(process.env.PORT || 8787);
app.listen(port, () => {
	// eslint-disable-next-line no-console
	console.log(`Compilator server listening on http://localhost:${port}`);
});

