import { Router } from "express";
import multer from "multer";
import { extractTextFromFile } from "../services/extractText";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

export const filesRouter = Router();

filesRouter.post("/extract", upload.array("files", 10), async (req, res) => {
	try {
		const files = (req.files as Express.Multer.File[]) || [];
		if (!files.length) {
			return res.status(400).json({ error: "Nessun file ricevuto" });
		}
		const results = await Promise.all(files.map((f) => extractTextFromFile(f)));
		return res.json({ documents: results });
	} catch (err) {
		return res.status(500).json({ error: "Errore estrazione testi" });
	}
});

