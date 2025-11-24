import { AppSidebar } from "../AppSidebar";
import { useState } from "react";

export default function AppSidebarExample() {
  const [activeSection, setActiveSection] = useState<"documents" | "chat" | "compiler" | "generated">("documents");
  
  const mockDocuments = [
    { id: "1", name: "research-paper.pdf", type: "application/pdf" },
    { id: "2", name: "notes.txt", type: "text/plain" },
    { id: "3", name: "code-example.js", type: "text/code" },
  ];

  return (
    <div className="h-screen">
      <AppSidebar 
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        documents={mockDocuments}
      />
    </div>
  );
}
