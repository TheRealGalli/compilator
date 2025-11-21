import "dotenv/config";
import express from "express";
import cors from "cors";
import { filesRouter } from "./routes/files";
import { analyzeRouter } from "./routes/analyze";
import { compileRouter } from "./routes/compile";
import { integrationsRouter } from "./routes/integrations";

const app = express();

// CORS con supporto multi-origine (lista separata da virgole)
const corsEnv = process.env.CORS_ORIGIN || "*";
const allowedOrigins = corsEnv.split(",").map((s) => s.trim());
app.use(
	cors({
		origin: (origin, callback) => {
			// richieste server-to-server o same-origin
			if (!origin) return callback(null, true);
			if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
				return callback(null, true);
			}
			return callback(new Error("Not allowed by CORS"));
		},
		methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
		allowedHeaders: ["Content-Type", "Authorization", "Accept"],
		preflightContinue: false,
		optionsSuccessStatus: 204,
	}),
);
// Rispondi esplicitamente alle preflight
app.options("*", cors({ origin: allowedOrigins.includes("*") ? "*" : allowedOrigins }));
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

