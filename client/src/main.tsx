import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
// Global PDF Styles for Interactivity
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

createRoot(document.getElementById("root")!).render(<App />);
