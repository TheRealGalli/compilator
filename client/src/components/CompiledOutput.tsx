import { Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CompiledOutputProps {
  content: string;
  onCopy: () => void;
  onDownload: () => void;
}

export function CompiledOutput({ content, onCopy, onDownload }: CompiledOutputProps) {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Documento Compilato</CardTitle>
          <div className="flex gap-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={onCopy}
              disabled={!content}
              data-testid="button-copy-compiled"
            >
              <Copy className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={onDownload}
              disabled={!content}
              data-testid="button-download-compiled"
            >
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full px-6 pb-6">
          {content ? (
            <pre className="text-sm whitespace-pre-wrap font-mono leading-relaxed" data-testid="text-compiled-output">
              {content}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">
              Certamente, di seguito trovi il template compilato con informazioni
              esemplificative, dove nel mondo reale e dai tuoi documenti di contesto
              specificherò note dettagliate per ogni placeholder. Ti prego di sostituire
              questi testi con quelli reali prima di qualsiasi utilizzo ufficiale in questione.
            </p>
          )}
        </div>
        );
}
