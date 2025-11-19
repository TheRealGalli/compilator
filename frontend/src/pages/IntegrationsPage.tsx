import React from "react";
import { fetchExcelFileByUrl, setExcelCredentials, uploadAndExtract } from "../lib/api";
import DocumentList, { ExtractedDoc } from "../components/DocumentList";

export default function IntegrationsPage() {
	const [headerName, setHeaderName] = React.useState("X-API-Key");
	const [apiKey, setApiKey] = React.useState("");
	const [remoteUrl, setRemoteUrl] = React.useState("");
	const [downloadedDocs, setDownloadedDocs] = React.useState<ExtractedDoc[]>([]);
	const [loading, setLoading] = React.useState(false);
	const [message, setMessage] = React.useState("");

	async function handleSaveCreds() {
		setLoading(true);
		try {
			await setExcelCredentials({
				headerName: headerName || undefined,
				apiKey: apiKey || undefined,
			});
			setMessage("Credenziali salvate");
		} finally {
			setLoading(false);
		}
	}

	async function handleFetchRemote() {
		if (!remoteUrl) return;
		setLoading(true);
		setMessage("");
		try {
			const { base64, contentType } = await fetchExcelFileByUrl({
				url: remoteUrl,
			});
			// Trasforma il base64 in File e invialo alla pipeline di estrazione
			const binary = atob(base64);
			const len = binary.length;
			const bytes = new Uint8Array(len);
			for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
			const blob = new Blob([bytes], { type: contentType });
			const file = new File([blob], "remote.xlsx", { type: contentType });
			const res = await uploadAndExtract([file]);
			setDownloadedDocs(res.documents);
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="page">
			<h2>Integrazioni: Excel</h2>
			<p>Configura credenziali e importa file Excel da endpoint remoti (API/URL).</p>

			<div className="panel">
				<div className="panel-title">Credenziali</div>
				<label className="label">Header API</label>
				<input className="input" value={headerName} onChange={(e) => setHeaderName(e.currentTarget.value)} />
				<label className="label">API Key</label>
				<input className="input" value={apiKey} onChange={(e) => setApiKey(e.currentTarget.value)} />
				<button className="btn" onClick={handleSaveCreds} disabled={loading}>Salva</button>
				{message ? <div className="hint">{message}</div> : null}
			</div>

			<div className="panel">
				<div className="panel-title">Import remoto</div>
				<label className="label">URL file Excel</label>
				<input className="input" value={remoteUrl} onChange={(e) => setRemoteUrl(e.currentTarget.value)} placeholder="https://api.example.com/report.xlsx" />
				<button className="btn" onClick={handleFetchRemote} disabled={!remoteUrl || loading}>Scarica e analizza</button>
			</div>

			{loading ? <div className="loading">Caricamento…</div> : null}
			{downloadedDocs.length ? <DocumentList docs={downloadedDocs} /> : null}
		</div>
	);
}

