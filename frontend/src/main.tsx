import React from "react";
import { createRoot } from "react-dom/client";
import { createHashRouter, RouterProvider } from "react-router-dom";
import App from "./App";
import NotebookPage from "./pages/NotebookPage";
import AnalyzeNotebookPage from "./pages/AnalyzeNotebookPage";
import IntegrationsPage from "./pages/IntegrationsPage";
import "./styles.css";

const router = createHashRouter([
	{
		path: "/",
		element: <App />,
		children: [
			{ index: true, element: <NotebookPage /> },
			{ path: "analyze", element: <AnalyzeNotebookPage /> },
			{ path: "integrations", element: <IntegrationsPage /> },
		],
	},
]);

const container = document.getElementById("root")!;
const root = createRoot(container);
root.render(<RouterProvider router={router} />);

