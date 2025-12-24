import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { AppSidebar } from "@/components/AppSidebar";
import { DocumentsSection } from "@/components/DocumentsSection";
import { ChatInterface } from "@/components/ChatInterface";
import { DocumentCompilerSection } from "@/components/DocumentCompilerSection";
import { GeneratedContentSection } from "@/components/GeneratedContentSection";
import { ConnectorsSection } from "../components/ConnectorsSection";
import { PinnedSourcePreview } from "@/components/PinnedSourcePreview";
import { useSources } from "@/contexts/SourcesContext";

type Section = "documents" | "chat" | "compiler" | "generated" | "connectors";

export default function Home() {
  const [activeSection, setActiveSection] = useState<Section>("documents");
  const [modelProvider, setModelProvider] = useState<'openai' | 'gemini'>('gemini');
  const { sources, removeSource, toggleSource, togglePin, pinnedSource } = useSources();

  const renderSection = () => {
    switch (activeSection) {
      case "documents":
        return <DocumentsSection />;
      case "chat":
        return (
          <div className="h-full flex gap-4 p-4">
            {pinnedSource && (
              <div className="w-96 flex-shrink-0">
                <PinnedSourcePreview />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <ChatInterface modelProvider={modelProvider} />
            </div>
          </div>
        );
      case "compiler":
        return <DocumentCompilerSection modelProvider={modelProvider} onModelProviderChange={setModelProvider} />;
      case "generated":
        return <GeneratedContentSection />;
      case "connectors":
        return <ConnectorsSection />;
      default:
        return <DocumentsSection />;
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <AppHeader notebookTitle="Gromit" onHomeClick={() => setActiveSection("documents")} />
      <div className="flex-1 flex overflow-hidden">
        <AppSidebar
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          sources={sources}
          onRemoveSource={removeSource}
          onToggleSource={toggleSource}
          onTogglePin={togglePin}
        />
        <main className="flex-1 overflow-auto">
          {renderSection()}
        </main>
      </div>
    </div>
  );
}
