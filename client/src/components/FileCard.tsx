import { File, X, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface FileCardProps {
  name: string;
  size?: string;
  onRemove?: () => void;
}

export function FileCard({ name, size = "1.2 MB", onRemove }: FileCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-primary/10 rounded-md flex items-center justify-center flex-shrink-0">
          <FileText className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate" data-testid={`text-filename-${name}`}>{name}</p>
          <p className="text-xs text-muted-foreground" data-testid="text-filesize">{size}</p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={onRemove}
          data-testid="button-remove-file"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </Card>
  );
}
