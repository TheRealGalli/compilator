import { AppSidebar } from "../AppSidebar";
import { useState } from "react";

export default function AppSidebarExample() {
  const [activeSection, setActiveSection] = useState<"documents" | "chat" | "compiler" | "generated" | "connectors">("documents");

  const mockSources = [
    { id: "1", name: "research-paper.pdf", type: "application/pdf", size: 1024, selected: true },
    { id: "2", name: "notes.txt", type: "text/plain", size: 512, selected: true },
    { id: "3", name: "code-example.js", type: "text/code", size: 2048, selected: true },
  ];

  return (
    <div className="h-screen">
      <AppSidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        sources={mockSources as any}
      />
    </div>
  );
}
