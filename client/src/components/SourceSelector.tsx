import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { FileText, Image, Music, Pin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
}

interface SourceSelectorProps {
  sources: Source[];
  onToggle?: (id: string) => void;
  onToggleMaster?: (id: string) => void;
}

export function SourceSelector({ sources, onToggle, onToggleMaster }: SourceSelectorProps) {
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
                className="flex items-center gap-2 p-1.5 rounded-md hover-elevate active-elevate-2 group"
                data-testid={`source-item-${source.id}`}
              >
                <Checkbox
                  checked={source.selected}
                  onCheckedChange={() => onToggle?.(source.id)}
                  data-testid={`checkbox-source-${source.id}`}
                  className="w-3.5 h-3.5"
                />
                <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${source.isXfa
                  ? 'text-red-500 fill-red-500/20'
                  : source.isAlreadyFilled
                    ? 'text-orange-500 fill-orange-500/20'
                    : source.isFillable
                      ? 'text-green-500 fill-green-500/20'
                      : 'text-muted-foreground'
                  }`} />
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

                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onToggleMaster?.(source.id)}
                  className={`h-6 w-6 flex-shrink-0 transition-all ${source.isMaster ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'}`}
                >
                  <Pin className={`w-3.5 h-3.5 ${source.isMaster ? 'text-blue-500 stroke-[3px]' : 'text-muted-foreground'}`} />
                </Button>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
