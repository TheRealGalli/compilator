import React from "react";
import FileUploader from "../components/FileUploader";
import DocumentList, { ExtractedDoc } from "../components/DocumentList";
import ChatPanel from "../components/ChatPanel";
import { uploadAndExtract } from "../lib/api";
import GlassIcons from "../components/GlassIcons";
import { FiFileText, FiBook, FiHeart, FiCloud, FiEdit, FiBarChart2 } from "react-icons/fi";

export default function AnalyzeNotebookPage() {
	const [docs, setDocs] = React.useState<ExtractedDoc[]>([]);
	const [loading, setLoading] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);

	// Modals
	const [showUploadModal, setShowUploadModal] = React.useState(false);
	const [activeFolder, setActiveFolder] = React.useState<string | null>(null);

	// Show upload modal on first load if no docs
	React.useEffect(() => {
		if (docs.length === 0) {
			const timer = setTimeout(() => setShowUploadModal(true), 500);
			return () => clearTimeout(timer);
		}
	}, []);

	const items = [
		{ icon: <FiFileText />, color: "blue" as const, label: "Files", onClick: () => setActiveFolder("Files") },
		{ icon: <FiBook />, color: "purple" as const, label: "Books", onClick: () => setActiveFolder("Books") },
		{ icon: <FiHeart />, color: "red" as const, label: "Health", onClick: () => setActiveFolder("Health") },
		{ icon: <FiCloud />, color: "indigo" as const, label: "Weather", onClick: () => setActiveFolder("Weather") },
		{ icon: <FiEdit />, color: "orange" as const, label: "Notes", onClick: () => setActiveFolder("Notes") },
		{ icon: <FiBarChart2 />, color: "green" as const, label: "Stats", onClick: () => setActiveFolder("Stats") },
	];

	async function addDocs(files: File[]) {
		setLoading(true);
		setError(null);
		setShowUploadModal(false); // Close modal on upload start
		try {
			const res = await uploadAndExtract(files);
			setDocs((d) => [...d, ...res.documents].slice(0, 10));
		} catch (e: any) {
			console.error(e);
			setError(e.message || "Errore durante il caricamento.");
			// Re-open modal if it was the first upload and it failed? Maybe not to annoy.
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
							<div className="panel-title">Analizzatore</div>
							<p>Carica fino a 10 documenti e fai domande nella chat a destra.</p>
							<div style={{ height: "200px", position: "relative", marginBottom: 12 }}>
								<GlassIcons items={items} className="custom-class" />
							</div>
							<FileUploader name="analyze" onFiles={addDocs} maxFiles={10} />
							<div className="row space small">
								<div className="muted">Documenti caricati</div>
								<div className="badge">{docs.length}/10</div>
							</div>
							{loading ? <div className="loading">Elaborazione…</div> : null}
							{error ? <div className="error-message" style={{ color: "var(--accent-red, #ff4d4d)", marginTop: 10 }}>{error}</div> : null}
							{docs.length ? <DocumentList docs={docs} /> : <div className="muted">Nessun documento caricato</div>}
						</div>
					</div>
					<div className="right-pane">
						<ChatPanel mode="analyze" docsForChat={docs} />
					</div>
				</div>
			</section>

			{/* First Time Upload Modal (NotebookLM style) */}
			{showUploadModal && docs.length === 0 && (
				<div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
					<div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ width: 600, textAlign: "center", padding: 40 }}>
						<h2 style={{ fontSize: 28, marginBottom: 16 }}>Benvenuto in Compilator</h2>
						<p style={{ fontSize: 16, color: "var(--muted)", marginBottom: 32 }}>
							Per iniziare, carica i tuoi documenti. Puoi usare PDF, Word, Excel o immagini.
						</p>
						<div style={{ border: "2px dashed var(--border)", borderRadius: 24, padding: 40, background: "rgba(255,255,255,0.02)" }}>
							<FileUploader name="modal-upload" onFiles={addDocs} maxFiles={10} help="Trascina qui i file per iniziare" />
						</div>
						<button className="soft" onClick={() => setShowUploadModal(false)} style={{ marginTop: 24, color: "var(--muted)" }}>
							Chiudi e esplora
						</button>
					</div>
				</div>
			)}

			{/* Folder Modal */}
			{activeFolder && (
				<div className="modal-overlay" onClick={() => setActiveFolder(null)}>
					<div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ width: 500 }}>
						<div className="modal-header">
							<div className="modal-title">{activeFolder}</div>
							<button className="soft" onClick={() => setActiveFolder(null)} style={{ fontSize: 20 }}>&times;</button>
						</div>
						<div className="modal-body">
							<p>Contenuto della cartella {activeFolder}...</p>
							<div className="hint">Funzionalità in arrivo. Qui potrai vedere i file salvati in questa categoria.</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

