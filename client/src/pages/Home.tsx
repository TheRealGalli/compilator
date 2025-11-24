import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { AppSidebar } from "@/components/AppSidebar";
import { DocumentsSection } from "@/components/DocumentsSection";
import { ChatInterface } from "@/components/ChatInterface";
import { CompilerSection } from "@/components/CompilerSection";
import { GeneratedContentSection } from "@/components/GeneratedContentSection";

type Section = "documents" | "chat" | "compiler" | "generated";

export default function Home() {
  const [activeSection, setActiveSection] = useState<Section>("documents");

  const mockDocuments = [
    { id: "1", name: "research-paper.pdf", type: "application/pdf" },
    { id: "2", name: "meeting-notes.txt", type: "text/plain" },
    { id: "3", name: "code-analysis.js", type: "text/code" },
  ];

  const renderSection = () => {
    switch (activeSection) {
      case "documents":
        return <DocumentsSection />;
      case "chat":
        return <ChatInterface />;
      case "compiler":
        return <CompilerSection />;
      case "generated":
        return <GeneratedContentSection />;
      default:
        return <DocumentsSection />;
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <AppHeader notebookTitle="My Research Notebook" />
      <div className="flex-1 flex overflow-hidden">
        <AppSidebar
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          documents={mockDocuments}
        />
        <main className="flex-1 overflow-auto">
          {renderSection()}
        </main>
      </div>
    </div>
  );
}
