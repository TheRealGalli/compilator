import { File, X, FileText, Image, Music, Pin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface FileCardProps {
  name: string;
  size?: string;
  onRemove?: () => void;
}

export function FileCard({ name, size = "1.2 MB", onRemove }: FileCardProps) {
  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return Image;
    if (['mp3', 'wav', 'ogg', 'flac', 'm4a', 'webm'].includes(ext)) return Music;
    return FileText;
  };

  const Icon = getFileIcon(name);

  return (
    <Card className="p-2 transition-all hover:shadow-sm">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-primary/10 rounded-md flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm whitespace-normal break-all leading-tight mb-0.5" data-testid={`text-filename-${name}`}>{name}</p>
          <p className="text-[10px] text-muted-foreground leading-none" data-testid="text-filesize">{size}</p>
        </div>



        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 -mr-1"
          onClick={onRemove}
          data-testid="button-remove-file"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
    </Card>
  );
}
