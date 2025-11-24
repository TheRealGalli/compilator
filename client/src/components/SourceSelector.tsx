import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium">Fonti Disponibili</h3>
        <Badge variant="secondary" data-testid="badge-selected-count">
          {selectedCount}/9 selezionate
        </Badge>
      </div>
      <div className="space-y-2">
        {sources.map((source) => (
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
            <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm flex-1 truncate">{source.name}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
