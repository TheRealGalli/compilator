import React from "react";

export type ExtractedDoc = {
	name: string;
	mimeType: string;
	sizeBytes: number;
	text: string;
	sourceKind: "pdf" | "docx" | "xlsx" | "image" | "plain" | "unknown";
};

export default function DocumentList({ docs }: { docs: ExtractedDoc[] }) {
	return (
		<div className="doc-list">
			{docs.map((d) => (
				<div className="doc-card" key={d.name + d.sizeBytes}>
					<div className="doc-head">
						<div className="doc-name">{d.name}</div>
						<div className="doc-kind">{d.sourceKind}</div>
					</div>
				</div>
			))}
		</div>
	);
}

