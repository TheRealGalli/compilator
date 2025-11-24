import { Upload } from "lucide-react";
import { useRef } from "react";

interface FileUploadZoneProps {
  onFilesSelected?: (files: FileList) => void;
}

export function FileUploadZone({ onFilesSelected }: FileUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected?.(e.target.files);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesSelected?.(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div
      onClick={handleClick}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      className="border-2 border-dashed rounded-lg p-12 text-center cursor-pointer hover-elevate active-elevate-2 transition-colors"
      data-testid="zone-file-upload"
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.txt,.docx,.doc"
        className="hidden"
        onChange={handleFileChange}
        data-testid="input-file-hidden"
      />
      <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
      <h3 className="text-lg font-medium mb-2">Trascina i file qui o clicca per sfogliare</h3>
      <p className="text-sm text-muted-foreground">
        Formati supportati: PDF, TXT, DOCX (Max 10MB per file)
      </p>
    </div>
  );
}
