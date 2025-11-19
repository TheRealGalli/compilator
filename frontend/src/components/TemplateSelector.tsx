import React from "react";
import FileUploader from "./FileUploader";
import type { ExtractedDoc } from "./DocumentList";

type Props = {
	template: ExtractedDoc | null;
	onTemplateFiles: (files: File[]) => void;
	onClear: () => void;
};

export default function TemplateSelector({ template, onTemplateFiles, onClear }: Props) {
	return (
		<div className="template-box">
			<div className="template-header">
				<div className="template-title">Template (opzionale)</div>
				{template ? <button className="btn" onClick={onClear}>Rimuovi</button> : null}
			</div>
			{template ? (
				<div className="template-preview">
					<div className="doc-head">
						<div className="doc-name">{template.name}</div>
						<div className="doc-kind">{template.sourceKind}</div>
					</div>
					<pre className="doc-text">
{(template.text || "").slice(0, 1000)}
{template.text.length > 1000 ? "\n...[troncato]..." : ""}
					</pre>
				</div>
			) : (
				<FileUploader
					name="template"
					multiple={false}
					maxFiles={1}
					onFiles={onTemplateFiles}
					help="Carica 1 file: PDF, DOCX, XLSX o immagine. Oppure lascia vuoto."
				/>
			)}
		</div>
	);
}

