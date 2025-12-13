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
                className="flex items-center gap-3 p-2 rounded-md hover-elevate active-elevate-2"
                data-testid={`source-item-${source.id}`}
              >
                <Checkbox
                  checked={source.selected}
                  onCheckedChange={() => onToggle?.(source.id)}
                  data-testid={`checkbox-source-${source.id}`}
                />
                <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-sm flex-1 truncate cursor-default">
                      {source.name}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
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
