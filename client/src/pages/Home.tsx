import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { AppSidebar } from "@/components/AppSidebar";
import { DocumentsSection } from "@/components/DocumentsSection";
import { ChatInterface } from "@/components/ChatInterface";
import { DocumentCompilerSection } from "@/components/DocumentCompilerSection";
import { GeneratedContentSection } from "@/components/GeneratedContentSection";
import { useSources } from "@/contexts/SourcesContext";

type Section = "documents" | "chat" | "compiler" | "generated";

export default function Home() {
  const [activeSection, setActiveSection] = useState<Section>("documents");
  const [modelProvider, setModelProvider] = useState<'openai' | 'gemini'>('gemini');
  const { sources, removeSource, toggleSource } = useSources();

  const renderSection = () => {
    switch (activeSection) {
      case "documents":
        return <DocumentsSection />;
      case "chat":
        return <ChatInterface modelProvider={modelProvider} />;
      case "compiler":
        return <DocumentCompilerSection modelProvider={modelProvider} onModelProviderChange={setModelProvider} />;
      case "generated":
        return <GeneratedContentSection />;
      default:
        return <DocumentsSection />;
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <AppHeader notebookTitle="Gromit" />
      <div className="flex-1 flex overflow-hidden">
        <AppSidebar
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          sources={sources}
          onRemoveSource={removeSource}
          onToggleSource={toggleSource}
        />
        <main className="flex-1 overflow-auto">
          {renderSection()}
        </main>
      </div>
    </div>
  );
}
