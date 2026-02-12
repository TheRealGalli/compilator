import { Copy, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormattedMessage } from "./FormattedMessage";

interface CompiledOutputProps {
  content: string;
  onCopy: () => void;
  onDownload: () => void;
  readOnly?: boolean;
}

export function CompiledOutput({ content, onCopy, onDownload, readOnly = false }: CompiledOutputProps) {
  return (
    <Card className="h-full flex flex-col min-h-0">
      <CardHeader className="flex-shrink-0 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Documento Compilato</CardTitle>
          <div className="flex gap-2">
            {!readOnly && (
              <>
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
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 overflow-y-auto p-6">
        {content ? (
          <div className="text-sm" data-testid="text-compiled-output">
            <FormattedMessage content={content} />
          </div>
        ) : (
          <div className="text-sm text-muted-foreground space-y-4">
            <p className="font-medium">Il Compilatore AI trasforma template in documenti completi.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
