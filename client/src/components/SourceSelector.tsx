import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { FileText, Image, Music, Pin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCompiler } from "@/contexts/CompilerContext";
import { useSources } from "@/contexts/SourcesContext";
import { useToast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Source {
  id: string;
  name: string;
  selected: boolean;
  isMemory?: boolean;
  isMaster?: boolean;
  isFillable?: boolean;
  isAlreadyFilled?: boolean;
  isXfa?: boolean;
  isBypass?: boolean;
}

interface SourceSelectorProps {
  isAuthenticated: boolean;
}

export function SourceSelector({ isAuthenticated = true }: SourceSelectorProps) {
  const { isLocked, frozenColor } = useCompiler();
  const { sources, addSource, toggleSource, toggleMaster, toggleBypass } = useSources();
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();

  // Filter out memory files from the UI list
  const visibleSources = sources.filter(s => !s.isMemory);
  const selectedCount = visibleSources.filter(s => s.selected === true).length;

  // Debug Hooks
  const instanceId = useState(Math.random().toString(36).slice(2, 7))[0];
  const renderTime = new Date().toLocaleTimeString();

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    for (const file of files) {
      const result = await addSource(file);
      if (result === 'limit_reached') {
        toast({
          title: "Limite raggiunto",
          description: "Massimo 10 fonti per sessione.",
          variant: "destructive"
        });
        break;
      } else if (result === 'duplicate') {
        toast({
          title: "File già presente",
          description: `${file.name} è già stato caricato.`,
        });
      } else if (result === 'file_too_large') {
        toast({
          title: "File troppo grande",
          description: `${file.name} supera il limite di 30MB.`,
          variant: "destructive"
        });
      } else if (result === 'error') {
        toast({
          title: "Errore caricamento",
          description: `Impossibile caricare ${file.name}.`,
          variant: "destructive"
        });
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };



  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return Image;
    if (['mp3', 'wav', 'ogg', 'flac', 'm4a', 'webm'].includes(ext)) return Music;
    return FileText;
  };

  const truncateFilename = (name: string, maxLength: number = 24): string => {
    if (name.length <= maxLength) return name;
    // Show first 12, last 5 (roughly)
    return `${name.slice(0, 15)}...${name.slice(-4)}`;
  };

  return (
    <div
      translate="no"
      className={`h-full flex flex-col border rounded-lg bg-background overflow-hidden transition-all duration-200 notranslate ${isDragging ? 'border-blue-500 bg-blue-500/5 ring-2 ring-blue-500/20' : ''
        }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={(e) => { setIsDragging(false); handleDrop(e); }}
    >
      <div className="border-b px-4 py-3 bg-muted/30 flex items-center justify-between flex-shrink-0">
        <h3 className="text-sm font-medium">Fonti Disponibili</h3>
        <Badge variant="secondary" data-testid="badge-selected-count">
          {selectedCount}/10
        </Badge>
      </div>

      {/* DEBUG OVERLAY - TO BE REMOVED AFTER DIAGNOSIS */}
      <div className="px-4 py-2 bg-red-500/10 text-[10px] font-mono text-red-500 border-b border-red-500/20">
        <p>DEBUG INFO (Context-Direct):</p>
        <p>Instance: {instanceId} | Time: {renderTime}</p>
        <p>Total Sources: {sources.length}</p>
        <p>Visible Sources: {visibleSources.length}</p>
        <p>Selected Count: {selectedCount}</p>
        <p>First Source State: {visibleSources.length > 0 ? JSON.stringify({
          id: visibleSources[0].id.substring(0, 8),
          sel: visibleSources[0].selected,
          type: typeof visibleSources[0].selected
        }) : 'None'}</p>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {visibleSources.map((source) => {
            const Icon = getFileIcon(source.name);
            return (
              <div
                key={source.id}
                className={`flex items-center gap-2 p-1.5 rounded-md group ${isLocked && source.isMaster ? 'opacity-80' : 'hover-elevate active-elevate-2'}`}
                data-testid={`source-item-${source.id}`}
              >
                <Checkbox
                  checked={source.selected}
                  onCheckedChange={() => !(isLocked && source.isMaster) && toggleSource(source.id)}
                  disabled={isLocked && source.isMaster}
                  data-testid={`checkbox-source-${source.id}`}
                  className="w-3.5 h-3.5 data-[state=checked]:flex data-[state=checked]:items-center data-[state=checked]:justify-center [&>span]:flex [&>span]:items-center [&>span]:justify-center"
                />
                <Tooltip delayDuration={300}>
                  <TooltipTrigger asChild>
                    <Icon
                      onClick={() => !(isLocked && source.isMaster) && toggleBypass(source.id)}
                      className={`w-3.5 h-3.5 flex-shrink-0 transition-all ${isLocked && source.isMaster ? 'cursor-default' : 'cursor-pointer hover:scale-110 active:scale-95'} ${!isAuthenticated
                        ? 'text-muted-foreground'
                        : isLocked && source.isMaster && frozenColor
                          ? frozenColor
                          : source.isBypass
                            ? 'text-muted-foreground'
                            : source.isXfa
                              ? 'text-red-500 fill-red-500/20'
                              : source.isAlreadyFilled
                                ? 'text-orange-500 fill-orange-500/20'
                                : source.isFillable
                                  ? 'text-green-500 fill-green-500/20'
                                  : 'text-muted-foreground'
                        }`}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>{!isAuthenticated ? 'Login richiesto per funzioni avanzate' : isLocked && source.isMaster ? 'Fonte congelata dalla sessione' : source.isBypass ? 'Ripristina analisi intelligente' : 'Forza modalità standard (Grigio)'}</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip delayDuration={300}>
                  <TooltipTrigger asChild>
                    <span className="text-xs flex-1 cursor-default min-w-0 whitespace-nowrap">
                      {truncateFilename(source.name)}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="z-[9999]">
                    <p>{source.name}</p>
                  </TooltipContent>
                </Tooltip>

                {(() => {
                  const ext = source.name.split('.').pop()?.toLowerCase() || '';
                  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'heic'].includes(ext);
                  const isAudio = ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'webm'].includes(ext);
                  const isPinnable = !isImage && !isAudio;

                  return isPinnable && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => toggleMaster(source.id)}
                      className={`h-6 w-6 flex-shrink-0 transition-all ${source.isMaster ? 'opacity-100' : isLocked ? 'opacity-0' : 'opacity-0 group-hover:opacity-40'}`}
                    >
                      <Pin className={`w-3.5 h-3.5 ${source.isMaster ? 'text-blue-500 stroke-[3px]' : 'text-muted-foreground'}`} />
                    </Button>
                  );
                })()}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
