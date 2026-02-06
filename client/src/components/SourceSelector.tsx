import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { FileText, Image, Music, Pin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCompiler } from "@/contexts/CompilerContext";
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
  sources: Source[];
  onToggle?: (id: string) => void;
  onToggleMaster?: (id: string) => void;
  onToggleBypass?: (id: string) => void;
}

export function SourceSelector({ sources, onToggle, onToggleMaster, onToggleBypass }: SourceSelectorProps) {
  const { isLocked, frozenColor } = useCompiler();
  // Filter out memory files from the UI list
  const visibleSources = sources.filter(s => !s.isMemory);
  const selectedCount = visibleSources.filter(s => s.selected).length;

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
    <div className="h-full flex flex-col border rounded-lg bg-background overflow-hidden">
      <div className="border-b px-4 py-3 bg-muted/30 flex items-center justify-between flex-shrink-0">
        <h3 className="text-sm font-medium">Fonti Disponibili</h3>
        <Badge variant="secondary" data-testid="badge-selected-count">
          {selectedCount}/10
        </Badge>
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
                  onCheckedChange={() => !(isLocked && source.isMaster) && onToggle?.(source.id)}
                  disabled={isLocked && source.isMaster}
                  data-testid={`checkbox-source-${source.id}`}
                  className="w-3.5 h-3.5"
                />
                <Tooltip delayDuration={300}>
                  <TooltipTrigger asChild>
                    <Icon
                      onClick={() => !(isLocked && source.isMaster) && onToggleBypass?.(source.id)}
                      className={`w-3.5 h-3.5 flex-shrink-0 transition-all ${isLocked && source.isMaster ? 'cursor-default' : 'cursor-pointer hover:scale-110 active:scale-95'} ${isLocked && source.isMaster && frozenColor
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
                    <p>{isLocked && source.isMaster ? 'Fonte congelata dalla sessione' : source.isBypass ? 'Ripristina analisi intelligente' : 'Forza modalità standard (Grigio)'}</p>
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
                      onClick={() => onToggleMaster?.(source.id)}
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
