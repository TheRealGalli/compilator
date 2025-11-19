import React from "react";
import type { ExtractedDoc } from "./DocumentList";
import { analyzeDocuments } from "../lib/api";

type Message = { role: "user" | "assistant"; text: string };

export default function ChatPanel({
	mode,
	docsForChat,
}: {
	mode: "analyze" | "compile";
	docsForChat: ExtractedDoc[];
}) {
	const [messages, setMessages] = React.useState<Message[]>([]);
	const [input, setInput] = React.useState("");
	const [loading, setLoading] = React.useState(false);

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
			const assistant: Message = { role: "assistant", text: res.resultText };
			setMessages((m) => [...m, assistant]);
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

