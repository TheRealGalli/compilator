export type ExtractedDocument = {
	name: string;
	mimeType: string;
	sizeBytes: number;
	text: string;
	sourceKind: "pdf" | "docx" | "xlsx" | "image" | "plain" | "unknown";
	pages?: number;
	worksheetNames?: string[];
};

export type AnalyzeRequest = {
	task?: string;
	documents: Array<Pick<ExtractedDocument, "name" | "text">>;
};

export type CompileRequest = {
	instructions?: string;
	template?: Pick<ExtractedDocument, "name" | "text"> | null;
	sources: Array<Pick<ExtractedDocument, "name" | "text">>;
	outputFormat?: "docx" | "markdown" | "text";
};

