import React from "react";
import FileUploader from "../components/FileUploader";
import DocumentList, { ExtractedDoc } from "../components/DocumentList";
import TemplateSelector from "../components/TemplateSelector";
import { uploadAndExtract, compileDocument } from "../lib/api";
import Folder from "../components/Folder";
import Modal from "../components/Modal";
import GooeyNav from "../components/GooeyNav";

export default function NotebookPage() {
	const [template, setTemplate] = React.useState<ExtractedDoc | null>(null);
	const [sources, setSources] = React.useState<ExtractedDoc[]>([]);
	const [loading, setLoading] = React.useState(false);
	// Prompt management state
	const [notesOpen, setNotesOpen] = React.useState(false);
	const [sectionsOpen, setSectionsOpen] = React.useState(false);
	const [guardrailsOpen, setGuardrailsOpen] = React.useState(false);
	const [notesText, setNotesText] = React.useState("");
	const [sectionProfile, setSectionProfile] = React.useState<string | null>(null);
	const [guardrailNote, setGuardrailNote] = React.useState("");
	const [selectedGuardrails, setSelectedGuardrails] = React.useState<string[]>([]);
	const [availableProfiles, setAvailableProfiles] = React.useState<string[]>([
		"Assistente legale",
		"Project Manager",
		"Consulente dati",
		"Revisore GDPR",
		"Copywriter SEO",
	]);
	const [guardrailBlocks, setGuardrailBlocks] = React.useState<string[]>([
		"Hallucination check",
		"GDPR",
		"Dati sensibili",
		"Bias",
		"Citation enforce",
	]);
	// upload refs
	const noteFileRef = React.useRef<HTMLInputElement | null>(null);
	const sectionsFileRef = React.useRef<HTMLInputElement | null>(null);
	const guardsFileRef = React.useRef<HTMLInputElement | null>(null);

	// persist to localStorage
	React.useEffect(() => {
		try {
			const saved = localStorage.getItem("compilation-prompt-state");
			if (saved) {
				const obj = JSON.parse(saved);
				if (obj.notesText) setNotesText(obj.notesText);
				if (obj.sectionProfile) setSectionProfile(obj.sectionProfile);
				if (obj.guardrailNote) setGuardrailNote(obj.guardrailNote);
				if (Array.isArray(obj.availableProfiles)) setAvailableProfiles(obj.availableProfiles);
				if (Array.isArray(obj.guardrailBlocks)) setGuardrailBlocks(obj.guardrailBlocks);
			}
		} catch {}
	}, []);
	React.useEffect(() => {
		try {
			localStorage.setItem(
				"compilation-prompt-state",
				JSON.stringify({
					notesText,
					sectionProfile,
					guardrailNote,
					availableProfiles,
					guardrailBlocks,
				}),
			);
		} catch {}
	}, [notesText, sectionProfile, guardrailNote, availableProfiles, guardrailBlocks]);

	async function addTemplate(files: File[]) {
		if (!files.length) return;
		setLoading(true);
		try {
			const res = await uploadAndExtract([files[0]]);
			setTemplate(res.documents[0]);
		} finally {
			setLoading(false);
		}
	}

	async function addSources(files: File[]) {
		setLoading(true);
		try {
			const res = await uploadAndExtract(files);
			setSources((s) => [...s, ...res.documents].slice(0, 9));
		} finally {
			setLoading(false);
		}
	}

	async function compile() {
		if (!sources.length) return;
		setLoading(true);
		try {
			const finalInstructions = [
				sectionProfile ? `Profilo di sistema: ${sectionProfile}` : "",
				notesText ? `Note generiche:\n${notesText}` : "",
				guardrailNote ? `Nota guardrail:\n${guardrailNote}` : "",
				selectedGuardrails.length ? `Guardrails attivi: ${selectedGuardrails.join(", ")}` : "",
			]
				.filter(Boolean)
				.join("\n\n");
			const res = await compileDocument({
				instructions: finalInstructions || undefined,
				template: template ? { name: template.name, text: template.text } : null,
				sources: sources.map((s) => ({ name: s.name, text: s.text })),
				outputFormat: "docx",
			});
			if ("blob" in res) {
				const filename =
					(template?.name?.replace(/\.[^/.]+$/, "") || "documento_compilato") + ".docx";
				const url = URL.createObjectURL(res.blob);
				const a = document.createElement("a");
				a.href = url;
				a.download = filename;
				a.click();
				URL.revokeObjectURL(url);
			}
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="notebook no-sidebar">
			<section className="notebook-main">
				<div className="notebook-grid">
					<div className="left-pane">
						<div className="panel">
							<div className="panel-title">Compilatore</div>
							<p>Carica 1 documento da compilare e fino a 9 fonti</p>
							<div
								style={{
									height: "160px",
									position: "relative",
									marginBottom: 12,
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									gap: 36,
								}}
							>
								<Folder
									size={1.25}
									color="#5227FF"
									items={[
										// ordine logico: 0 Note, 1 Sezioni, 2 Guardrail
										<span style={{ padding: 8, display: "inline-block" }}>Note</span>,
										<span style={{ padding: 8, display: "inline-block" }}>Sezioni</span>,
										<span style={{ padding: 8, display: "inline-block" }}>Guardrail</span>,
									]}
									// mappa visiva: paper1 <- Guardrail (2), paper2 <- Sezioni (1), paper3 <- Note (0)
									order={[2, 1, 0]}
									className="custom-folder"
									onPaperClick={(idx) => {
										// click si riferisce ai paper 1/2/3 -> 0/1/2
										// con order=[2,1,0] => paper0=Guardrail, paper1=Sezioni, paper2=Note
										if (idx === 0) setGuardrailsOpen(true);
										if (idx === 1) setSectionsOpen(true);
										if (idx === 2) setNotesOpen(true);
									}}
								/>
								<Folder
									size={1.1}
									color="#22C55E"
									items={[
										<span style={{ padding: 8, display: "inline-block" }}>Fonti</span>,
										<span style={{ padding: 8, display: "inline-block" }}>Validazione</span>,
										<span style={{ padding: 8, display: "inline-block" }}>Output</span>,
									]}
								/>
							</div>
							<div className="panel soft">
								<div className="section-title">Documento da compilare</div>
								<TemplateSelector
									template={template}
									onTemplateFiles={addTemplate}
									onClear={() => setTemplate(null)}
								/>
							</div>
							<div className="panel soft">
								<div className="row space small">
									<div className="section-title">Fonti</div>
									<div className="badge">{sources.length}/9</div>
								</div>
								<FileUploader name="sources" maxFiles={9} onFiles={addSources} />
								{sources.length ? (
									<>
										<DocumentList docs={sources} />
										<div className="row" style={{ marginTop: 8 }}>
											<button className="btn" onClick={() => setSources([])}>Svuota fonti</button>
											<button className="btn primary" onClick={compile} disabled={!sources.length || loading}>
												{loading ? "..." : "Compila e scarica DOCX"}
											</button>
										</div>
									</>
								) : null}
							</div>
						</div>
					</div>
					<div className="right-pane">
						<div className="panel">
							<div className="panel-title">Istruzioni</div>
							<p className="muted">Il documento compilato verrà generato lato server e scaricato come DOCX. I file non vengono salvati.</p>
							<ul>
								<li>Carica un template (opzionale) per guidare la struttura</li>
								<li>Aggiungi fino a 9 fonti (PDF/DOCX/XLSX/immagini)</li>
								<li>Clicca “Compila e scarica DOCX”</li>
							</ul>
						</div>
					</div>
				</div>
			</section>
			<Modal title="Note generiche" open={notesOpen} onClose={() => setNotesOpen(false)} width={720}>
				<p className="muted">Queste note influiranno sulla generazione del documento.</p>
				<textarea className="textarea" rows={8} value={notesText} onChange={(e) => setNotesText(e.currentTarget.value)} placeholder="Es. Stile formale, tono professionale, includere sezioni KPI..." />
				<div className="row" style={{ marginTop: 10 }}>
					<input ref={noteFileRef} type="file" accept=".txt,.md,.json" style={{ display: "none" }} onChange={(e) => {
						const f = e.currentTarget.files?.[0]; if (!f) return;
						const reader = new FileReader();
						reader.onload = () => {
							try {
								const t = String(reader.result || "");
								if (f.name.endsWith(".json")) {
									const obj = JSON.parse(t); setNotesText(obj.notes || obj.text || t);
								} else setNotesText(t);
							} catch { setNotesText(String(reader.result || "")); }
						}; reader.readAsText(f);
					}} />
					<button className="btn" onClick={() => noteFileRef.current?.click()}>Importa testo</button>
					<button className="btn" onClick={() => {
						const blob = new Blob([notesText], { type: "text/plain;charset=utf-8" });
						const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "note.txt"; a.click(); URL.revokeObjectURL(a.href);
					}}>Esporta</button>
				</div>
			</Modal>
			<Modal title="Sezioni / Profili di sistema" open={sectionsOpen} onClose={() => setSectionsOpen(false)} width={780}>
				<p className="muted">Scegli un profilo che imposta comportamenti di sistema più profondi.</p>
				<div className="row" style={{ marginBottom: 8 }}>
					<input ref={sectionsFileRef} type="file" accept=".json" style={{ display: "none" }} onChange={(e) => {
						const f = e.currentTarget.files?.[0]; if (!f) return;
						const reader = new FileReader();
						reader.onload = () => {
							try { const arr = JSON.parse(String(reader.result || "[]")); if (Array.isArray(arr)) setAvailableProfiles(arr.map(String)); } catch {}
						}; reader.readAsText(f);
					}} />
					<button className="btn" onClick={() => sectionsFileRef.current?.click()}>Importa profili (.json)</button>
					<button className="btn" onClick={() => {
						const blob = new Blob([JSON.stringify(availableProfiles, null, 2)], { type: "application/json" });
						const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "profili.json"; a.click(); URL.revokeObjectURL(a.href);
					}}>Esporta</button>
				</div>
				<div className="doc-list" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
					{availableProfiles.map((p) => (
						<div key={p} className="doc-card" onClick={() => setSectionProfile(p)} style={{ cursor: "pointer", borderColor: sectionProfile === p ? "#4c8bf5" : undefined }}>
							<div className="doc-head"><div className="doc-name">{p}</div></div>
							<div className="muted">Profilo di sistema</div>
						</div>
					))}
				</div>
			</Modal>
			<Modal title="Guardrail" open={guardrailsOpen} onClose={() => setGuardrailsOpen(false)} width={860}>
				<div style={{ display: "grid", gridTemplateRows: "1fr auto", gap: 12 }}>
					<div>
						<label className="label">Nota guardrail</label>
						<textarea className="textarea" rows={5} value={guardrailNote} onChange={(e) => setGuardrailNote(e.currentTarget.value)} placeholder="Istruzioni aggiuntive di sicurezza/limiti..." />
					</div>
					<div>
						<label className="label">Blocchi guardrail</label>
						<div className="row" style={{ marginBottom: 8 }}>
							<input ref={guardsFileRef} type="file" accept=".json" style={{ display: "none" }} onChange={(e) => {
								const f = e.currentTarget.files?.[0]; if (!f) return;
								const reader = new FileReader();
								reader.onload = () => {
									try { const arr = JSON.parse(String(reader.result || "[]")); if (Array.isArray(arr)) setGuardrailBlocks(arr.map(String)); } catch {}
								}; reader.readAsText(f);
							}} />
							<button className="btn" onClick={() => guardsFileRef.current?.click()}>Importa guardrail (.json)</button>
							<button className="btn" onClick={() => {
								const blob = new Blob([JSON.stringify(guardrailBlocks, null, 2)], { type: "application/json" });
								const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "guardrails.json"; a.click(); URL.revokeObjectURL(a.href);
							}}>Esporta</button>
						</div>
						<div className="gooey-wrapper">
							<GooeyNav
								items={guardrailBlocks.map((g) => ({ label: g }))}
								onSelect={(_i: number, item: any) => {
									setSelectedGuardrails((prev) => (prev.includes(item.label) ? prev : [...prev, item.label]));
								}}
							/>
						</div>
						{selectedGuardrails.length ? (
							<div style={{ marginTop: 10 }} className="doc-list">
								{selectedGuardrails.map((g) => (
									<div key={g} className="doc-card"><div className="doc-name">{g}</div></div>
								))}
							</div>
						) : null}
					</div>
				</div>
			</Modal>
		</div>
	);
}

