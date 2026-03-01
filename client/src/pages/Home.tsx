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

  // FALLBACK: Handle session ID from URL (Incognito/Cross-domain)
  // MUST BE BEFORE any API calls (like useQuery) to ensure the session ID is set
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

  // Global Auth Loading Check to prevent "Login Flash"
  const { data: userData, isFetched: isAuthAttempted, refetch: refetchUser } = useQuery({
    queryKey: ['/api/user'],
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Restore self-hosted URL from user profile when logging in
  useEffect(() => {
    if (userData && (userData as any).selfHostedUrl) {
      const serverUrl = (userData as any).selfHostedUrl;
      const localUrl = localStorage.getItem('gromit_custom_backend_url');
      if (!localUrl && serverUrl) {
        console.log('[Session] Restoring selfHostedUrl from profile:', serverUrl);
        localStorage.setItem('gromit_custom_backend_url', serverUrl);
        localStorage.setItem('gromit_private_cloud_url', serverUrl);
        window.location.reload();
      }
    }
  }, [userData]);

  // Ensure session remains stable on soft refresh and handle navigation from hash
  useEffect(() => {
    // We let the session persist as requested. 
    console.log("[Session] App mounted. Session ID preserved.");

    // Handle hash-based navigation (e.g. #connectors)
    const handleHashNav = () => {
      const hash = window.location.hash.replace('#', '');
      if (['documents', 'chat', 'compiler', 'generated', 'connectors'].includes(hash)) {
        setActiveSection(hash as Section);
      }
    };

    handleHashNav();
    window.addEventListener('hashchange', handleHashNav);
    return () => window.removeEventListener('hashchange', handleHashNav);
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
