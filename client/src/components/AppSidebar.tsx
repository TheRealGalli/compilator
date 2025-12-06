import { FileText, MessageSquare, Code, Sparkles, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { SourceSelector } from "@/components/SourceSelector";
import type { Source } from "@/contexts/SourcesContext";

interface AppSidebarProps {
  activeSection?: "documents" | "chat" | "compiler" | "generated";
  onSectionChange?: (section: "documents" | "chat" | "compiler" | "generated") => void;
  sources?: Source[];
  onRemoveSource?: (id: string) => void;
  onToggleSource?: (id: string) => void;
}

export function AppSidebar({
  activeSection = "documents",
  onSectionChange = () => { },
  sources = [],
  onToggleSource
}: AppSidebarProps) {
  const sections = [
    { id: "documents" as const, label: "Documenti", icon: FileText },
    { id: "chat" as const, label: "Analizzatore", icon: MessageSquare },
    { id: "compiler" as const, label: "Compilatore", icon: Code },
    { id: "generated" as const, label: "Generati", icon: Sparkles },
  ];

  return (
    <aside className="w-[280px] border-r bg-sidebar flex flex-col h-full">

      <div className="p-4">
        <h3 className="text-sm font-medium mb-3 text-muted-foreground">Sezioni</h3>
        <div className="flex flex-col gap-1">
          {sections.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            return (
              <Button
                key={section.id}
                variant={isActive ? "secondary" : "ghost"}
                className="justify-start"
                onClick={() => onSectionChange(section.id)}
                data-testid={`button-section-${section.id}`}
              >
                <Icon className="w-4 h-4 mr-2" />
                {section.label}
              </Button>
            );
          })}
        </div>
      </div>

      <Separator />

      <div className="flex-1 overflow-hidden flex flex-col p-4">
        <SourceSelector sources={sources} onToggle={onToggleSource} />
      </div>


    </aside>
  );
}
