import { FileUploadZone } from "./FileUploadZone";
import { FileCard } from "./FileCard";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface Document {
  id: string;
  name: string;
  size: string;
  gcsPath?: string;
}

export function DocumentsSection() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const handleFilesSelected = async (files: FileList) => {
    setIsUploading(true);
    
    try {
      const { getApiUrl } = await import("@/lib/api-config");
      
      const uploadPromises = Array.from(files).map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch(getApiUrl('/api/files/upload'), {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || 'Upload fallito');
        }
        
        const data = await response.json();
        
        if (data.success && data.file) {
          return {
            id: Math.random().toString(36).substring(7),
            name: data.file.fileName,
            size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
            gcsPath: data.file.gcsPath,
          };
        }
        throw new Error('Upload fallito');
      });
      
      const uploadedDocs = await Promise.all(uploadPromises);
      setDocuments([...documents, ...uploadedDocs]);
      
      toast({
        title: "File caricati con successo",
        description: `${uploadedDocs.length} file caricato/i su Google Cloud Storage`,
      });
    } catch (error: any) {
      console.error('Errore durante upload:', error);
      toast({
        title: "Errore durante upload",
        description: error.message || "Si è verificato un errore durante il caricamento dei file.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = async (id: string) => {
    const doc = documents.find(d => d.id === id);
    
    if (doc?.gcsPath) {
      try {
        await apiRequest('DELETE', `/api/files/${doc.gcsPath}`);
        setDocuments(documents.filter((doc) => doc.id !== id));
        toast({
          title: "File eliminato",
          description: "Il file è stato eliminato con successo.",
        });
      } catch (error: any) {
        console.error('Errore durante eliminazione:', error);
        toast({
          title: "Errore",
          description: "Si è verificato un errore durante l'eliminazione del file.",
          variant: "destructive",
        });
      }
    } else {
      setDocuments(documents.filter((doc) => doc.id !== id));
    }
  };

  return (
    <div className="h-full flex flex-col p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Documenti</h2>
        {documents.length > 0 && (
          <Button data-testid="button-analyze-documents">
            <Sparkles className="w-4 h-4 mr-2" />
            Analizza Documenti
          </Button>
        )}
      </div>

      <div className="mb-6">
        <FileUploadZone 
          onFilesSelected={handleFilesSelected} 
          disabled={isUploading}
        />
      </div>

      {documents.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            File Caricati ({documents.length})
          </h3>
          <div className="space-y-2">
            {documents.map((doc) => (
              <FileCard
                key={doc.id}
                name={doc.name}
                size={doc.size}
                onRemove={() => handleRemove(doc.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
