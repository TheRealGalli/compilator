import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Copy, Download } from "lucide-react";

interface CompiledOutputProps {
  content?: string;
  onCopy?: () => void;
  onDownload?: () => void;
}

export function CompiledOutput({ 
  content = "",
  onCopy,
  onDownload
}: CompiledOutputProps) {
  return (
    <div className="h-full flex flex-col border rounded-lg overflow-hidden bg-background">
      <div className="border-b px-4 py-2 bg-muted/30 flex items-center justify-between">
        <h3 className="text-sm font-medium">Documento Compilato</h3>
        <div className="flex gap-2">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onCopy} data-testid="button-copy-output">
            <Copy className="w-3 h-3" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onDownload} data-testid="button-download-output">
            <Download className="w-3 h-3" />
          </Button>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4">
          {content ? (
            <div className="prose prose-sm max-w-none" data-testid="text-compiled-output">
              <pre className="whitespace-pre-wrap font-sans">{content}</pre>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nessun documento compilato. Seleziona un modello e clicca "Compila" per generare il documento.
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
