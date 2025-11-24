import { FileText, MessageSquare, Code, Sparkles, Plus, File, FileCode, FileType, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

interface AppSidebarProps {
  activeSection?: "documents" | "chat" | "compiler" | "generated";
  onSectionChange?: (section: "documents" | "chat" | "compiler" | "generated") => void;
  documents?: Array<{ id: string; name: string; type: string }>;
  onRemoveDocument?: (id: string) => void;
}

export function AppSidebar({
  activeSection = "documents",
  onSectionChange = () => {},
  documents = [],
  onRemoveDocument
}: AppSidebarProps) {
  const sections = [
    { id: "documents" as const, label: "Documenti", icon: FileText },
    { id: "chat" as const, label: "Chat", icon: MessageSquare },
    { id: "compiler" as const, label: "Compilatore", icon: Code },
    { id: "generated" as const, label: "Generati", icon: Sparkles },
  ];

  const getFileIcon = (type: string) => {
    if (type.includes("pdf")) return File;
    if (type.includes("code")) return FileCode;
    return FileType;
  };

  return (
    <aside className="w-[280px] border-r bg-sidebar flex flex-col h-full">
      <div className="p-4">
        <Button className="w-full" data-testid="button-new-notebook">
          <Plus className="w-4 h-4 mr-2" />
          Nuovo Notebook
        </Button>
      </div>

      <Separator />

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

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="p-4 pb-2">
          <h3 className="text-sm font-medium text-muted-foreground">Fonti</h3>
        </div>
        <ScrollArea className="flex-1 px-4">
          {documents.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Nessun documento caricato</p>
          ) : (
            <div className="flex flex-col gap-2 pb-4">
              {documents.map((doc) => {
                const Icon = getFileIcon(doc.type);
                return (
                  <div
                    key={doc.id}
                    className="flex items-center gap-2 p-2 rounded-md hover-elevate active-elevate-2 group"
                    data-testid={`file-item-${doc.id}`}
                  >
                    <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm truncate flex-1 cursor-pointer">{doc.name}</span>
                    {onRemoveDocument && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveDocument(doc.id);
                        }}
                        data-testid={`button-remove-${doc.id}`}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      <Separator />

      <div className="p-4">
        <div className="bg-accent/50 rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-2">Spazio Utilizzato</p>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">2.4 GB / 10 GB</span>
            <Badge variant="secondary" className="text-xs">24%</Badge>
          </div>
        </div>
      </div>
    </aside>
  );
}
