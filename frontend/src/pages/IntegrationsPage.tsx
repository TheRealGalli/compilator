import React from "react";
import { FaFileExcel } from "react-icons/fa";
import { SiGooglesheets, SiGooglecalendar } from "react-icons/si";
import { fetchExcelFileByUrl, setExcelCredentials, uploadAndExtract } from "../lib/api";
import DocumentList, { ExtractedDoc } from "../components/DocumentList";

type IntegrationType = "excel" | "sheets" | "calendar" | null;

export default function IntegrationsPage() {
	const [selected, setSelected] = React.useState<IntegrationType>(null);
	const [downloadedDocs, setDownloadedDocs] = React.useState<ExtractedDoc[]>([]);

	const integrations = [
		{
			id: "excel" as const,
			name: "Excel",
			icon: <FaFileExcel size={48} color="#1D6F42" />,
			desc: "Importa file da API o URL remoti",
		},
		{
			id: "sheets" as const,
			name: "Google Sheets",
			icon: <SiGooglesheets size={48} color="#0F9D58" />,
			desc: "Connetti fogli di calcolo Google",
		},
		{
			id: "calendar" as const,
			name: "Google Calendar",
			icon: <SiGooglecalendar size={48} color="#4285F4" />,
			desc: "Analizza eventi e pianificazioni",
		},
	];

	return (
		<div className="page">
			<div style={{ marginBottom: 32 }}>
				<h2>Integrazioni</h2>
				<p>Collega le tue app preferite per importare dati e documenti.</p>
			</div>

			<div className="integrations-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 24 }}>
				{integrations.map((item) => (
					<div
						key={item.id}
						className="panel integration-card"
						onClick={() => setSelected(item.id)}
						style={{ cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 16, transition: "transform 0.2s" }}
					>
						<div style={{ padding: 16, background: "rgba(255,255,255,0.05)", borderRadius: "50%" }}>
							{item.icon}
						</div>
						<div>
							<div style={{ fontWeight: 600, fontSize: 18, marginBottom: 4 }}>{item.name}</div>
							<div className="muted" style={{ fontSize: 14 }}>{item.desc}</div>
						</div>
					</div>
				))}
			</div>

			{downloadedDocs.length > 0 && (
				<div style={{ marginTop: 40 }}>
					<h3>Documenti Importati</h3>
					<DocumentList docs={downloadedDocs} />
				</div>
			)}

			{selected && (
				<IntegrationModal
					type={selected}
					onClose={() => setSelected(null)}
					onDocsLoaded={(docs) => setDownloadedDocs((prev) => [...prev, ...docs])}
				/>
			)}
		</div>
	);
}

function IntegrationModal({
	type,
	onClose,
	onDocsLoaded,
}: {
	type: "excel" | "sheets" | "calendar";
	onClose: () => void;
	onDocsLoaded: (docs: ExtractedDoc[]) => void;
}) {
	const [loading, setLoading] = React.useState(false);
	const [message, setMessage] = React.useState("");

	// Excel State
	const [headerName, setHeaderName] = React.useState("X-API-Key");
	const [apiKey, setApiKey] = React.useState("");
	const [remoteUrl, setRemoteUrl] = React.useState("");

	// Google State (Placeholder)
	const [clientId, setClientId] = React.useState("");
	const [clientSecret, setClientSecret] = React.useState("");

	async function handleSaveExcel() {
		setLoading(true);
		try {
			await setExcelCredentials({
				headerName: headerName || undefined,
				apiKey: apiKey || undefined,
			});
			setMessage("Credenziali salvate con successo!");
		} catch (e) {
			setMessage("Errore salvataggio credenziali");
		} finally {
			setLoading(false);
		}
	}

	async function handleFetchExcel() {
		if (!remoteUrl) return;
		setLoading(true);
		setMessage("");
		try {
			const { base64, contentType } = await fetchExcelFileByUrl({ url: remoteUrl });
			const binary = atob(base64);
			const len = binary.length;
			const bytes = new Uint8Array(len);
			for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
			const blob = new Blob([bytes], { type: contentType });
			const file = new File([blob], "remote.xlsx", { type: contentType });
			const res = await uploadAndExtract([file]);
			onDocsLoaded(res.documents);
			onClose();
		} catch (e) {
			setMessage("Errore durante il download o l'analisi.");
		} finally {
			setLoading(false);
		}
	}

	async function handleSaveGoogle() {
		setLoading(true);
		// Placeholder logic
		setTimeout(() => {
			setMessage("Credenziali Google salvate (Simulazione)");
			setLoading(false);
		}, 1000);
	}

	return (
		<div className="modal-overlay" onClick={onClose}>
			<div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ width: 500 }}>
				<div className="modal-header">
					<div className="modal-title">
						Configura {type === "excel" ? "Excel" : type === "sheets" ? "Google Sheets" : "Google Calendar"}
					</div>
					<button className="soft" onClick={onClose} style={{ fontSize: 20 }}>&times;</button>
				</div>
				<div className="modal-body">
					{type === "excel" && (
						<>
							<div style={{ marginBottom: 20 }}>
								<h4 style={{ margin: "0 0 12px" }}>Credenziali API</h4>
								<label className="label">Header Name</label>
								<input className="input" value={headerName} onChange={(e) => setHeaderName(e.currentTarget.value)} />
								<label className="label">API Key</label>
								<input className="input" value={apiKey} onChange={(e) => setApiKey(e.currentTarget.value)} type="password" />
								<button className="btn" onClick={handleSaveExcel} disabled={loading} style={{ marginTop: 12, width: "100%" }}>
									Salva Credenziali
								</button>
							</div>
							<hr style={{ borderColor: "var(--border)", opacity: 0.5 }} />
							<div style={{ marginTop: 20 }}>
								<h4 style={{ margin: "0 0 12px" }}>Importa da URL</h4>
								<label className="label">URL File Excel</label>
								<input className="input" value={remoteUrl} onChange={(e) => setRemoteUrl(e.currentTarget.value)} placeholder="https://..." />
								<button className="btn primary" onClick={handleFetchExcel} disabled={!remoteUrl || loading} style={{ marginTop: 12, width: "100%" }}>
									{loading ? "Caricamento..." : "Scarica e Analizza"}
								</button>
							</div>
						</>
					)}

					{(type === "sheets" || type === "calendar") && (
						<>
							<div style={{ marginBottom: 20 }}>
								<p className="hint" style={{ marginBottom: 16 }}>
									Inserisci le credenziali del tuo account di servizio Google o OAuth Client ID.
								</p>
								<label className="label">Client ID</label>
								<input className="input" value={clientId} onChange={(e) => setClientId(e.currentTarget.value)} />
								<label className="label">Client Secret</label>
								<input className="input" value={clientSecret} onChange={(e) => setClientSecret(e.currentTarget.value)} type="password" />
								<button className="btn primary" onClick={handleSaveGoogle} disabled={loading} style={{ marginTop: 20, width: "100%" }}>
									{loading ? "Salvataggio..." : "Connetti Account Google"}
								</button>
							</div>
						</>
					)}

					{message && (
						<div className="result" style={{ marginTop: 16, background: "rgba(59, 130, 246, 0.1)", borderColor: "rgba(59, 130, 246, 0.2)" }}>
							{message}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

