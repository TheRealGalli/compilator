import { useState, useEffect } from "react";
import { AppHeader } from "@/components/AppHeader";
import { setSessionId } from "@/lib/queryClient";
import { AppSidebar } from "@/components/AppSidebar";
import { DocumentsSection } from "@/components/DocumentsSection";
import { ChatInterface } from "@/components/ChatInterface";
import { DocumentCompilerSection } from "@/components/DocumentCompilerSection";
import { GeneratedContentSection } from "@/components/GeneratedContentSection";
import { ConnectorsSection } from "../components/ConnectorsSection";
import { useSources } from "@/contexts/SourcesContext";
import { useQuery } from "@tanstack/react-query";
import { LoadingScreen } from "@/components/LoadingScreen";

type Section = "documents" | "chat" | "compiler" | "generated" | "connectors";

export default function Home() {
  const [activeSection, setActiveSection] = useState<Section>("documents");
  const [modelProvider, setModelProvider] = useState<'openai' | 'gemini'>('gemini');
  const { sources, removeSource, toggleSource, toggleMaster, toggleBypass } = useSources();

  // Global Auth Loading Check to prevent "Login Flash"
  const { isFetched: isAuthAttempted, refetch: refetchUser } = useQuery({
    queryKey: ['/api/user'],
    retry: false,
    refetchOnWindowFocus: false,
  });

  // FALLBACK: Handle session ID from URL (Incognito/Cross-domain)
  useState(() => {
    const params = new URLSearchParams(window.location.search);
    const sid = params.get('sid');
    if (sid) {
      setSessionId(sid);
      // Clean URL
      const newUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, '', newUrl);
      console.log("[Auth] Session Handshake: sid captured and stored in memory");
    }
  });

  // Ensure session reset on full refresh
  useEffect(() => {
    // If we land here without a sid in URL, we might want to clear old localStorage 
    // ghost sid to ensure a fresh session for the AI.
    const params = new URLSearchParams(window.location.search);
    if (!params.get('sid')) {
      // We clear it only on mount. If a sid was just captured in useState, 
      // it would be in memory now.
      // But wait, if we want a TRULY new session on refresh, 
      // we should probably just let the server generate a new one if no cookie is present.
      // So we clear the localStorage 'csd_sid' on every mount.
      localStorage.removeItem('csd_sid');
      console.log("[Session] Page refresh detected. Clearing localStorage session ghost.");
    }
  }, []);

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
      case "connectors":
        return <ConnectorsSection />;
      default:
        return <DocumentsSection />;
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-x-auto overflow-y-hidden bg-background">
      <LoadingScreen isVisible={!isAuthAttempted} />

      <div className="min-w-[1360px] flex-1 flex flex-col overflow-hidden">
        <AppHeader notebookTitle="Gromit" onHomeClick={() => setActiveSection("documents")} />
        <div className="flex-1 flex overflow-hidden">
          <AppSidebar
            activeSection={activeSection}
            onSectionChange={setActiveSection}
            sources={sources}
            onRemoveSource={removeSource}
            onToggleSource={toggleSource}
            onToggleMaster={toggleMaster}
            onToggleBypass={toggleBypass}
          />
          <main className="flex-1 overflow-auto">
            {renderSection()}
          </main>
        </div>
      </div>
    </div>
  );
}
