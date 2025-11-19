import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
	plugins: [react()],
	server: {
		port: 5173,
	},
	// Auto‑detect base path on GitHub Actions → Pages
	base:
		(process.env.GITHUB_REPOSITORY && `/${process.env.GITHUB_REPOSITORY.split("/").pop()}/`) ||
		process.env.VITE_BASE ||
		"/",
})

