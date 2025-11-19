import React from "react";

export type GlassItem = {
	icon: React.ReactNode;
	color: "blue" | "purple" | "red" | "indigo" | "orange" | "green";
	label: string;
};

export default function GlassIcons({
	items,
	className,
}: {
	items: GlassItem[];
	className?: string;
}) {
	return (
		<div className={`glass-icons rb-glass-icons ${className || ""}`}>
			{items.map((it, i) => (
				<div
					key={i}
					className={`glass-icon rb-gi-item ${it.color}`}
					style={{ animationDelay: `${i * 60}ms` }}
				>
					<div className="icon rb-gi-icon">{it.icon}</div>
					<div className="label rb-gi-label">{it.label}</div>
				</div>
			))}
		</div>
	);
}

