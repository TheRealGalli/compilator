import { Checkbox } from "@/components/ui/checkbox";
import { FileText, Image, Music } from "lucide-react";
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
}

interface SourceSelectorProps {
  sources: Source[];
  onToggle?: (id: string) => void;
}

export function SourceSelector({ sources, onToggle }: SourceSelectorProps) {
  const selectedCount = sources.filter(s => s.selected).length;

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return Image;
    if (['mp3', 'wav', 'ogg', 'flac', 'm4a', 'webm'].includes(ext)) return Music;
    return FileText;
  };

  const truncateFilename = (name: string, maxLength: number = 30): string => {
    if (name.length <= maxLength) return name;
    return name.substring(0, maxLength) + "...";
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
          {sources.map((source) => {
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
                <Icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-xs flex-1 cursor-default min-w-0 break-all">
                      {truncateFilename(source.name)}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>{source.name}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
