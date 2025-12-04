import { Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CompiledOutputProps {
  content: string;
  onCopy: () => void;
  onDownload: () => void;
}

export function CompiledOutput({ content, onCopy, onDownload }: CompiledOutputProps) {
  return (
    <Card className="h-full flex flex-col min-h-0">
      <CardHeader className="flex-shrink-0 pb-3">
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
      <CardContent className="flex-1 min-h-0 overflow-y-auto p-6">
        {content ? (
          <pre className="text-sm whitespace-pre-wrap font-mono leading-relaxed" data-testid="text-compiled-output">
            {content}
          </pre>
        ) : (
          <div className="text-sm text-muted-foreground space-y-2">
            <p className="font-medium">Il Compilatore AI trasforma template in documenti completi.</p>
            <p>Seleziona un template preimpostato o carica il tuo, aggiungi documenti di contesto (visure, contratti, foto), e l'AI compilerà automaticamente tutti i placeholder con le informazioni estratte dai tuoi file.</p>
            <p className="text-xs">Perfetto per: contratti, relazioni tecniche, privacy policy, documenti legali.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
