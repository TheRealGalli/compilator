import React from "react";
import FileUploader from "../components/FileUploader";
import DocumentList, { ExtractedDoc } from "../components/DocumentList";
import TemplateSelector from "../components/TemplateSelector";
import { compileDocument, uploadAndExtract } from "../lib/api";

export default function CompilePage() {
	const [template, setTemplate] = React.useState<ExtractedDoc | null>(null);
	const [sources, setSources] = React.useState<ExtractedDoc[]>([]);
	const [instructions, setInstructions] = React.useState<string>("");
	const [format, setFormat] = React.useState<"docx" | "markdown" | "text">("docx");
	const [loading, setLoading] = React.useState(false);
	const [compiledText, setCompiledText] = React.useState<string>("");

	async function handleTemplate(files: File[]) {
		if (!files.length) return;
		setLoading(true);
		try {
			const res = await uploadAndExtract([files[0]]);
			setTemplate(res.documents[0]);
		} finally {
			setLoading(false);
		}
	}

	async function handleSources(files: File[]) {
		setLoading(true);
		try {
			const res = await uploadAndExtract(files);
			setSources((prev) => [...prev, ...res.documents].slice(0, 9));
		} finally {
			setLoading(false);
		}
	}

	function downloadBlob(blob: Blob, filename: string) {
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
	}

	async function handleCompile() {
		if (!sources.length) return;
		setLoading(true);
		try {
			const body = {
				instructions: instructions || undefined,
				template: template ? { name: template.name, text: template.text } : null,
				sources: sources.map((s) => ({ name: s.name, text: s.text })),
				outputFormat: format,
			} as const;
			const res = await compileDocument(body);
			if ("blob" in res) {
				const filename =
					(template?.name?.replace(/\.[^/.]+$/, "") || "documento_compilato") + ".docx";
				downloadBlob(res.blob, filename);
				setCompiledText("");
			} else {
				setCompiledText(res.compiledText);
			}
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="page">
			<h2>Compilazione</h2>
			<p>Usa 1 template (opzionale) e fino a 9 fonti per compilare un nuovo documento.</p>

			<TemplateSelector
				template={template}
				onTemplateFiles={handleTemplate}
				onClear={() => setTemplate(null)}
			/>

			<div className="panel">
				<div className="panel-title">Fonti (max 9)</div>
				<FileUploader name="sources" maxFiles={9} onFiles={handleSources} />
				{loading ? <div className="loading">Elaborazione…</div> : null}
				{sources.length ? <DocumentList docs={sources} /> : null}
				{sources.length ? (
					<button className="btn" onClick={() => setSources([])}>Svuota fonti</button>
				) : null}
			</div>

			<div className="panel">
				<label className="label">Istruzioni (opzionale)</label>
				<textarea
					className="textarea"
					value={instructions}
					onChange={(e) => setInstructions(e.currentTarget.value)}
					placeholder="Es. Compila secondo il template con stile formale e sezioni numerate…"
					rows={4}
				/>

				<label className="label">Formato output</label>
				<div className="row">
					<select value={format} onChange={(e) => setFormat(e.currentTarget.value as any)}>
						<option value="docx">DOCX (download)</option>
						<option value="markdown">Markdown (preview)</option>
						<option value="text">Testo (preview)</option>
					</select>
					<button
						className="btn primary"
						onClick={handleCompile}
						disabled={!sources.length || loading}
					>
						Compila
					</button>
				</div>
			</div>

			{compiledText ? (
				<div className="panel">
					<div className="panel-title">Output</div>
					<pre className="result">{compiledText}</pre>
				</div>
			) : null}
		</div>
	);
}

