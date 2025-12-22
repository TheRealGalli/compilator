import { File, X, FileText, Image, Music, Pin, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface FileCardProps {
  name: string;
  size?: string;
  isMemory?: boolean;
  onRemove?: () => void;
}

export function FileCard({ name, size = "1.2 MB", isMemory, onRemove }: FileCardProps) {
  const getFileIcon = (filename: string) => {
    if (isMemory) return Brain;
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return Image;
    if (['mp3', 'wav', 'ogg', 'flac', 'm4a', 'webm'].includes(ext)) return Music;
    return FileText;
  };

  const Icon = getFileIcon(name);

  return (
    <Card className={`p-2 transition-all hover:shadow-sm ${isMemory ? 'border-amber-500/50 bg-amber-500/5' : ''}`}>
      <div className="flex items-center gap-2">
        <div className={`w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 ${isMemory ? 'bg-amber-500/20' : 'bg-primary/10'}`}>
          <Icon className={`w-4 h-4 ${isMemory ? 'text-amber-500' : 'text-primary'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-medium text-sm whitespace-normal break-all leading-tight mb-0.5" data-testid={`text-filename-${name}`}>{name}</p>
            {isMemory && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 bg-amber-500 text-white rounded-full">MEMORY</span>
            )}
          </div>
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
