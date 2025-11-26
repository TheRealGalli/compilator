import { FileUploadZone } from "./FileUploadZone";
import { FileCard } from "./FileCard";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useSources } from "@/contexts/SourcesContext";

export function DocumentsSection() {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();
  const { sources, addSource, removeSource, maxSources } = useSources();

  const handleFilesSelected = async (selectedFiles: File[]) => {
    setIsUploading(true);
    try {
      let successCount = 0;
      let failedCount = 0;

      for (const file of selectedFiles) {
        const success = await addSource(file);
        if (success) {
          successCount++;
        } else {
          failedCount++;
        }
      }

      if (successCount > 0) {
        toast({
          title: "File aggiunti alle fonti",
          description: `${successCount} file${successCount > 1 ? ' aggiunti' : ' aggiunto'} alle fonti (max ${maxSources})`,
        });
      }

      if (failedCount > 0) {
        toast({
          title: "Limite raggiunto",
          description: `${failedCount} file non ${failedCount > 1 ? 'aggiunti' : 'aggiunto'} - limite massimo ${maxSources} fonti`,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Error adding files:', error);
      toast({
        title: "Errore",
        description: "Errore durante l'aggiunta dei file",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      removeSource(id);
      toast({
        title: "Fonte rimossa",
        description: "La fonte è stata rimossa dalla sessione",
      });
    } catch (error: any) {
      console.error('Error removing file:', error);
      toast({
        title: "Errore",
        description: "Errore durante la rimozione",
        variant: "destructive",
      });
    }
  };

  const formatSize = (bytes: number): string => {
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  return (
    <div className="h-full p-6 flex flex-col gap-6 overflow-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Gestione Documenti</h2>
          <p className="text-muted-foreground mt-1">
            Carica fino a {maxSources} fonti per l'analisi (solo sessione corrente)
          </p>
        </div>
        <Button>
          <Sparkles className="w-4 h-4 mr-2" />
          Genera Sommario
        </Button>
      </div>

      <FileUploadZone
        onFilesSelected={handleFilesSelected}
        disabled={isUploading}
      />

      {sources.length > 0 && (
        <div className="flex-1 overflow-auto">
          <h3 className="text-lg font-semibold mb-4">
            Fonti Caricate ({sources.length}/{maxSources})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sources.map((source) => (
              <FileCard
                key={source.id}
                name={source.name}
                size={formatSize(source.size)}
                onRemove={() => handleRemove(source.id)}
              />
            ))}
          </div>
        </div>
      )}

      {sources.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-center">
          <div className="max-w-md">
            <p className="text-muted-foreground">
              Nessuna fonte caricata. Trascina file qui sopra o clicca per selezionarli.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Le fonti sono temporanee e verranno rimosse al refresh della pagina.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
