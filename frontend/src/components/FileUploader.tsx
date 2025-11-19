import React from "react";

type Props = {
	name: string;
	multiple?: boolean;
	accept?: string;
	maxFiles?: number;
	onFiles: (files: File[]) => void;
	help?: string;
};

export default function FileUploader({
	name,
	multiple = true,
	accept,
	maxFiles = 10,
	onFiles,
	help,
}: Props) {
	const inputRef = React.useRef<HTMLInputElement | null>(null);
	const [isOver, setIsOver] = React.useState(false);

	function handleFiles(list: FileList | null) {
		if (!list) return;
		const files = Array.from(list).slice(0, maxFiles);
		onFiles(files);
	}

	return (
		<div
			className={`uploader ${isOver ? "over" : ""}`}
			onDragOver={(e) => {
				e.preventDefault();
				setIsOver(true);
			}}
			onDragLeave={() => setIsOver(false)}
			onDrop={(e) => {
				e.preventDefault();
				setIsOver(false);
				handleFiles(e.dataTransfer.files);
			}}
			onClick={() => inputRef.current?.click()}
		>
			<input
				ref={inputRef}
				name={name}
				type="file"
				accept={accept}
				multiple={multiple}
				onChange={(e) => handleFiles(e.currentTarget.files)}
				style={{ display: "none" }}
			/>
			<div className="uploader-inner">
				<div className="uploader-title">Trascina qui i file o clicca per selezionare</div>
				<div className="uploader-subtitle">
					{help || `PDF, DOCX, XLSX, immagini (max ${maxFiles} file)`}
				</div>
			</div>
		</div>
	);
}

