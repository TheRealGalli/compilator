import React from "react";
import FileUploader from "../components/FileUploader";
import DocumentList, { ExtractedDoc } from "../components/DocumentList";
import { analyzeDocuments, uploadAndExtract } from "../lib/api";

export default function AnalyzePage() {
	const [docs, setDocs] = React.useState<ExtractedDoc[]>([]);
	const [task, setTask] = React.useState<string>("");
	const [result, setResult] = React.useState<string>("");
	const [loading, setLoading] = React.useState(false);

	async function handleFiles(files: File[]) {
		setLoading(true);
		try {
			const res = await uploadAndExtract(files);
			setDocs(res.documents);
		} finally {
			setLoading(false);
		}
	}

	async function handleAnalyze() {
		if (!docs.length) return;
		setLoading(true);
		try {
			const res = await analyzeDocuments({
				task: task || undefined,
				documents: docs.map((d) => ({ name: d.name, text: d.text })),
			});
			setResult(res.resultText);
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="page">
			<h2>Analisi documenti</h2>
			<p>Carica fino a 10 file. Supportati: PDF, DOCX, XLSX, immagini (OCR).</p>
			<FileUploader name="files" onFiles={handleFiles} maxFiles={10} />
			{loading ? <div className="loading">Elaborazione…</div> : null}
			{docs.length ? <DocumentList docs={docs} /> : null}

			<div className="panel">
				<label className="label">Obiettivo analisi (opzionale)</label>
				<textarea
					className="textarea"
					value={task}
					onChange={(e) => setTask(e.currentTarget.value)}
					placeholder="Es. Riassunto comparativo, KPI, discrepanze, azioni suggerite…"
					rows={4}
				/>
				<button className="btn primary" onClick={handleAnalyze} disabled={!docs.length || loading}>
					Avvia analisi
				</button>
			</div>

			{result ? (
				<div className="panel">
					<div className="panel-title">Risultato analisi</div>
					<pre className="result">{result}</pre>
				</div>
			) : null}
		</div>
	);
}

