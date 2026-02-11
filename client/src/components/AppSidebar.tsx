import { FileText, MessageSquare, Code, Plug, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SourceSelector } from "@/components/SourceSelector";
import type { Source } from "@/contexts/SourcesContext";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface AppSidebarProps {
  activeSection?: "documents" | "chat" | "compiler" | "generated" | "connectors";
  onSectionChange?: (section: "documents" | "chat" | "compiler" | "generated" | "connectors") => void;
  sources?: Source[];
  onRemoveSource?: (id: string) => void;
  onToggleSource?: (id: string) => void;
  onToggleMaster?: (id: string) => void;
  onToggleBypass?: (id: string) => void;
}

export function AppSidebar({
  activeSection = "documents",
  onSectionChange = () => { },
  sources = [],
  onToggleSource,
  onToggleMaster,
  onToggleBypass
}: AppSidebarProps) {
  const { data: user } = useQuery({ queryKey: ['/api/user'] });
  const { toast } = useToast();
  const isAuthenticated = !!user;

  const sections = [
    { id: "documents" as const, label: "Documenti", icon: FileText, locked: false },
    { id: "chat" as const, label: "Analizzatore", icon: MessageSquare, locked: false },
    { id: "compiler" as const, label: "Compilatore", icon: Code, locked: !isAuthenticated },
    { id: "connectors" as const, label: "Connettori", icon: Plug, locked: !isAuthenticated },
  ];

  const handleSectionClick = (sectionId: any, isLocked: boolean) => {
    if (isLocked) {
      toast({
        title: "Accesso Negato",
        description: "Devi effettuare l'accesso per utilizzare questa funzionalità.",
        variant: "destructive"
      });
      // Optionally redirect to documents to show login overlay
      onSectionChange("documents");
      return;
    }
    onSectionChange(sectionId);
  };

  return (
    <aside className="w-[280px] border-r bg-sidebar flex flex-col h-full">
      <div className="p-4">
        <h3 className="text-sm font-medium mb-3 text-muted-foreground">Sezioni</h3>
        <div className="flex flex-col gap-1">
          {sections.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;

            return (
              <div key={section.id} className="flex items-center gap-2 w-full">
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className={`justify-start flex-1 ${section.locked ? 'opacity-70' : ''}`}
                  onClick={() => handleSectionClick(section.id, section.locked)}
                  data-testid={`button-section-${section.id}`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {section.label}
                  {section.locked && <Lock className="w-3 h-3 ml-auto text-muted-foreground" />}
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      <Separator />

      <div className="flex-1 overflow-hidden flex flex-col p-4">
        <SourceSelector
          sources={sources}
          onToggle={onToggleSource}
          onToggleMaster={onToggleMaster}
          onToggleBypass={onToggleBypass}
          isAuthenticated={isAuthenticated}
        />
      </div>
    </aside>
  );
}
