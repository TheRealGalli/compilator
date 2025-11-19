import React, { useState } from "react";
import "./Folder.css";

function darkenColor(hex: string, percent: number) {
	let color = hex.startsWith("#") ? hex.slice(1) : hex;
	if (color.length === 3) {
		color = color
			.split("")
			.map((c) => c + c)
			.join("");
	}
	const num = parseInt(color, 16);
	let r = (num >> 16) & 0xff;
	let g = (num >> 8) & 0xff;
	let b = num & 0xff;
	r = Math.max(0, Math.min(255, Math.floor(r * (1 - percent))));
	g = Math.max(0, Math.min(255, Math.floor(g * (1 - percent))));
	b = Math.max(0, Math.min(255, Math.floor(b * (1 - percent))));
	return (
		"#" +
		((1 << 24) + (r << 16) + (g << 8) + b)
			.toString(16)
			.slice(1)
			.toUpperCase()
	);
}

type Offset = { x: number; y: number };

export default function Folder({
	color = "#5227FF",
	size = 1,
	items = [],
	className = "",
	order = [0, 1, 2],
	onPaperClick,
}: {
	color?: string;
	size?: number;
	items?: Array<React.ReactNode>;
	className?: string;
	order?: [number, number, number]; // mapping: paper1<-order[0], paper2<-order[1], paper3<-order[2]
	onPaperClick?: (index: number) => void;
}) {
	const maxItems = 3;
	const padded = items.slice(0, maxItems);
	while (padded.length < maxItems) padded.push(null);
	// remap content to ensure desired front paper
	const papers = [padded[order[0]] ?? null, padded[order[1]] ?? null, padded[order[2]] ?? null];

	const [open, setOpen] = useState(false);
	const [paperOffsets, setPaperOffsets] = useState<Array<Offset>>(
		Array.from({ length: maxItems }, () => ({ x: 0, y: 0 })),
	);

	const folderBackColor = darkenColor(color, 0.08);
	const paper1 = darkenColor("#ffffff", 0.1);
	const paper2 = darkenColor("#ffffff", 0.05);
	const paper3 = "#ffffff";

	function handleClick() {
		setOpen((prev) => !prev);
		if (open) {
			setPaperOffsets(Array.from({ length: maxItems }, () => ({ x: 0, y: 0 })));
		}
	}

	function handlePaperMouseMove(
		e: React.MouseEvent<HTMLDivElement>,
		index: number,
	) {
		if (!open) return;
		const rect = e.currentTarget.getBoundingClientRect();
		const centerX = rect.left + rect.width / 2;
		const centerY = rect.top + rect.height / 2;
		const offsetX = (e.clientX - centerX) * 0.15;
		const offsetY = (e.clientY - centerY) * 0.15;
		setPaperOffsets((prev) => {
			const newOffsets = [...prev];
			newOffsets[index] = { x: offsetX, y: offsetY };
			return newOffsets;
		});
	}

	function handlePaperMouseLeave(_e: React.MouseEvent<HTMLDivElement>, index: number) {
		setPaperOffsets((prev) => {
			const newOffsets = [...prev];
			newOffsets[index] = { x: 0, y: 0 };
			return newOffsets;
		});
	}

	const folderStyle: React.CSSProperties = {
		["--folder-color" as any]: color,
		["--folder-back-color" as any]: folderBackColor,
		["--paper-1" as any]: paper1,
		["--paper-2" as any]: paper2,
		["--paper-3" as any]: paper3,
	};
	const folderClassName = `folder ${open ? "open" : ""}`.trim();
	const scaleStyle: React.CSSProperties = { transform: `scale(${size})` };

	return (
		<div style={scaleStyle} className={className}>
			<div className={folderClassName} style={folderStyle} onClick={handleClick}>
				<div className="folder__back">
					{papers.map((item, i) => (
						<div
							key={i}
							className={`paper paper-${i + 1}`}
							onMouseMove={(e) => handlePaperMouseMove(e, i)}
							onMouseLeave={(e) => handlePaperMouseLeave(e, i)}
							onClick={(e) => {
								e.stopPropagation();
								if (!open) {
                                    setOpen(true);
                                } else {
									onPaperClick?.(i);
								}
							}}
							style={
								open
									? {
											["--magnet-x" as any]: `${paperOffsets[i]?.x || 0}px`,
											["--magnet-y" as any]: `${paperOffsets[i]?.y || 0}px`,
										}
									: {}
							}
						>
							{item}
						</div>
					))}
					<div className="folder__front" />
					<div className="folder__front right" />
				</div>
			</div>
		</div>
	);
}

