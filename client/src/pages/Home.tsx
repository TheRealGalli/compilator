import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { AppSidebar } from "@/components/AppSidebar";
import { DocumentsSection } from "@/components/DocumentsSection";
import { ChatInterface } from "@/components/ChatInterface";
import { DocumentCompilerSection } from "@/components/DocumentCompilerSection";
import { GeneratedContentSection } from "@/components/GeneratedContentSection";

type Section = "documents" | "chat" | "compiler" | "generated";

export default function Home() {
  const [activeSection, setActiveSection] = useState<Section>("documents");
  const [documents, setDocuments] = useState([
    { id: "1", name: "documento-base.pdf", type: "application/pdf" },
    { id: "2", name: "dati-azienda.txt", type: "text/plain" },
    { id: "3", name: "informazioni-legali.docx", type: "application/docx" },
    { id: "4", name: "termini-servizio.pdf", type: "application/pdf" },
    { id: "5", name: "clausole-standard.txt", type: "text/plain" },
    { id: "6", name: "dati-contatto.pdf", type: "application/pdf" },
    { id: "7", name: "riferimenti-normativi.docx", type: "application/docx" },
    { id: "8", name: "template-base.txt", type: "text/plain" },
    { id: "9", name: "glossario-termini.pdf", type: "application/pdf" },
  ]);

  const handleRemoveDocument = (id: string) => {
    setDocuments(documents.filter(doc => doc.id !== id));
  };

  const renderSection = () => {
    switch (activeSection) {
      case "documents":
        return <DocumentsSection />;
      case "chat":
        return <ChatInterface />;
      case "compiler":
        return <DocumentCompilerSection />;
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
          documents={documents}
          onRemoveDocument={handleRemoveDocument}
        />
        <main className="flex-1 overflow-auto">
          {renderSection()}
        </main>
      </div>
    </div>
  );
}
