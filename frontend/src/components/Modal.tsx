import React from "react";

type ModalProps = {
	title?: string;
	open: boolean;
	onClose: () => void;
	children: React.ReactNode;
	width?: number | string;
};

export default function Modal({ title, open, onClose, children, width = 720 }: ModalProps) {
	if (!open) return null;
	return (
		<div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
			<div
				className="modal-content"
				style={{ width }}
				onClick={(e) => {
					e.stopPropagation();
				}}
			>
				<div className="modal-header">
					<div className="modal-title">{title}</div>
					<button className="btn" onClick={onClose} aria-label="Chiudi modale">
						Chiudi
					</button>
				</div>
				<div className="modal-body">{children}</div>
			</div>
		</div>
	);
}


