import React from "react";
import type { ExtractedDoc } from "./DocumentList";
import { analyzeDocuments } from "../lib/api";

type Message = { role: "user" | "assistant"; text: string };

export default function ChatPanel({
	mode,
	docsForChat,
	previewTokens,
}: {
	mode: "analyze" | "compile";
	docsForChat: ExtractedDoc[];
	previewTokens?: number; // es. 2000 per anteprima tipo NotebookLM
}) {
	const [messages, setMessages] = React.useState<Message[]>([]);
	const [input, setInput] = React.useState("");
	const [loading, setLoading] = React.useState(false);

	function truncateToTokens(text: string, maxTokens: number): string {
		if (!maxTokens || maxTokens <= 0) return text;
		// stima semplice: token = parole separate da spazi/punteggiatura
		const tokens = text.split(/\s+/g);
		if (tokens.length <= maxTokens) return text;
		const trimmed = tokens.slice(0, maxTokens).join(" ");
		return trimmed + "\n\n[Anteprima 2K token – contenuto troncato]";
	}

	async function send() {
		if (!input.trim() || !docsForChat.length || mode !== "analyze") return;
		const userMsg: Message = { role: "user", text: input.trim() };
		setMessages((m) => [...m, userMsg]);
		setInput("");
		setLoading(true);
		try {
			const res = await analyzeDocuments({
				task: userMsg.text,
				documents: docsForChat.map((d) => ({ name: d.name, text: d.text })),
			});
			const preview = previewTokens ? truncateToTokens(res.resultText, previewTokens) : res.resultText;
			const assistant: Message = { role: "assistant", text: preview };
			setMessages((m) => [...m, assistant]);
		} catch (err: any) {
			const msg =
				"Errore durante l'analisi. Controlla la connessione o le variabili VITE_SERVER_URL/CORS.\n" +
				(err?.message || String(err));
			setMessages((m) => [...m, { role: "assistant", text: msg }]);
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="chat-panel">
			<div className="chat-header">Chat with Documents</div>
			<div className={`chat-body ${mode === "compile" ? "locked" : ""}`}>
				{mode === "compile" ? (
					<div className="chat-locked">
						<div className="chat-locked-title">Chat bloccata in modalità compilatore</div>
						<div className="chat-locked-sub">Passa a Analizzatore per porre domande</div>
					</div>
				) : null}
				{!messages.length && mode !== "compile" ? (
					<div className="chat-empty">
						<div className="chat-empty-icon">💬</div>
						<div className="chat-empty-title">Start a conversation about your documents</div>
						<div className="chat-empty-sub">Upload documents and ask questions to begin</div>
					</div>
				) : null}
				{messages.length ? (
					<div className="chat-messages">
						{messages.map((m, i) => (
							<div key={i} className={`chat-message ${m.role}`}>
								<pre>{m.text}</pre>
							</div>
						))}
					</div>
				) : null}
			</div>
			<div className="chat-input-row">
				<input
					className="input chat-input"
					placeholder={
						mode === "compile"
							? "Chat disabilitata in modalità Compilatore"
							: "Chiedi sui tuoi documenti…"
					}
					disabled={mode === "compile" || loading || !docsForChat.length}
					value={input}
					onChange={(e) => setInput(e.currentTarget.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") send();
					}}
				/>
				<button className="btn" onClick={send} disabled={mode === "compile" || loading || !docsForChat.length}>
					{loading ? "..." : "Invia"}
				</button>
			</div>
		</div>
	);
}

