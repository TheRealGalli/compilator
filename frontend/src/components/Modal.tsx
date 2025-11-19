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
		<div className="modal-overlay" onClick={onClose}>
			<div
				className="modal-content"
				style={{ width }}
				onClick={(e) => {
					e.stopPropagation();
				}}
			>
				<div className="modal-header">
					<div className="modal-title">{title}</div>
					<button className="btn" onClick={onClose}>
						Chiudi
					</button>
				</div>
				<div className="modal-body">{children}</div>
			</div>
		</div>
	);
}


