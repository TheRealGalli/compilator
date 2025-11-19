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
	const items = [
		{ icon: <FiFileText />, color: "blue" as const, label: "Files" },
		{ icon: <FiBook />, color: "purple" as const, label: "Books" },
		{ icon: <FiHeart />, color: "red" as const, label: "Health" },
		{ icon: <FiCloud />, color: "indigo" as const, label: "Weather" },
		{ icon: <FiEdit />, color: "orange" as const, label: "Notes" },
		{ icon: <FiBarChart2 />, color: "green" as const, label: "Stats" },
	];

	async function addDocs(files: File[]) {
		setLoading(true);
		try {
			const res = await uploadAndExtract(files);
			setDocs((d) => [...d, ...res.documents].slice(0, 10));
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
							{docs.length ? <DocumentList docs={docs} /> : <div className="muted">Nessun documento caricato</div>}
						</div>
					</div>
					<div className="right-pane">
						<ChatPanel mode="analyze" docsForChat={docs} />
					</div>
				</div>
			</section>
		</div>
	);
}

