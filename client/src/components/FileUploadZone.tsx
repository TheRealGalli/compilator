import { Upload } from "lucide-react";
import { useRef } from "react";

interface FileUploadZoneProps {
  onFilesSelected?: (files: File[]) => void;
  disabled?: boolean;
}

export function FileUploadZone({ onFilesSelected, disabled }: FileUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected?.(Array.from(e.target.files));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesSelected?.(Array.from(e.dataTransfer.files));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div
      onClick={disabled ? undefined : handleClick}
      onDrop={disabled ? undefined : handleDrop}
      onDragOver={disabled ? undefined : handleDragOver}
      className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${disabled
        ? 'opacity-50 cursor-not-allowed'
        : 'cursor-pointer hover-elevate active-elevate-2'
        }`}
      data-testid="zone-file-upload"
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.txt,.docx,.doc,.csv,image/*,audio/*"
        className="hidden"
        onChange={handleFileChange}
        data-testid="input-file-hidden"
      />
      <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
      <h3 className="text-lg font-medium mb-2">Trascina i file qui o clicca per sfogliare</h3>
      <p className="text-sm text-muted-foreground">
        Testo: PDF, DOCX, TXT, CSV | Immagini: JPG, PNG, WebP | Audio: MP3, WAV, FLAC
      </p>
      <p className="text-xs text-muted-foreground/60 mt-2">
        Max 30MB per fonte supportati
      </p>
    </div>
  );
}
