import { useEffect, useState } from "react";
import { useSources } from "@/contexts/SourcesContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Asterisk, Loader2, FileEdit } from "lucide-react";
import { getApiUrl } from "@/lib/api-config";
import { useToast } from "@/hooks/use-toast";

export function PinnedSourcePreview() {
    const { pinnedSource } = useSources();
    const [preview, setPreview] = useState<string>("");
    const [isLoading, setIsLoading] = useState(false);
    const [isCompiling, setIsCompiling] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (!pinnedSource) {
            setPreview("");
            return;
        }

        // Generate preview when pinned source changes
        generatePreview();
    }, [pinnedSource?.id]); // Track by ID to detect changes

    const generatePreview = async () => {
        if (!pinnedSource) return;

        setIsLoading(true);
        try {
            const response = await fetch(getApiUrl("/api/preview-pinned"), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    source: {
                        name: pinnedSource.name,
                        type: pinnedSource.type,
                        base64: pinnedSource.base64,
                    },
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Errore durante generazione preview");
            }

            const data = await response.json();
            setPreview(data.preview);
        } catch (error: any) {
            console.error("Error generating preview:", error);
            toast({
                title: "Errore Preview",
                description: error.message || "Impossibile generare la preview del documento.",
                variant: "destructive",
            });
            setPreview("");
        } finally {
            setIsLoading(false);
        }
    };

    const compileForm = async () => {
        if (!pinnedSource) return;

        setIsCompiling(true);
        toast({
            title: "Compilazione in corso...",
            description: "Sto analizzando i campi e generando il documento compilato.",
        });

        try {
            const response = await fetch(getApiUrl("/api/compile-scanned-form"), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    pinnedSource: {
                        name: pinnedSource.name,
                        type: pinnedSource.type,
                        base64: pinnedSource.base64,
                    },
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Errore durante compilazione form");
            }

            const data = await response.json();

            // Download compiled PDF
            const { compiledDocument, fieldsDetected, fieldsFilled } = data;
            const byteCharacters = atob(compiledDocument.base64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: compiledDocument.mimeType });

            const { saveAs } = await import("file-saver");
            saveAs(blob, compiledDocument.name);

            toast({
                title: "✅ Form Compilato!",
                description: `${fieldsFilled}/${fieldsDetected} campi compilati con successo.`,
            });
        } catch (error: any) {
            console.error("Error compiling form:", error);
            toast({
                title: "Errore Compilazione",
                description: error.message || "Impossibile compilare il form.",
                variant: "destructive",
            });
        } finally {
            setIsCompiling(false);
        }
    };

    // Don't render if no pinned source
    if (!pinnedSource) return null;

    const isPDF = pinnedSource.type.includes("pdf");

    return (
        <Card className="flex flex-col h-full border-2 border-blue-500/30 bg-gradient-to-br from-blue-50/50 to-purple-50/50 dark:from-blue-950/20 dark:to-purple-950/20">
            {/* Header with *** */}
            <div className="border-b px-4 py-3 bg-blue-500/10 flex items-center gap-3 flex-shrink-0">
                <div className="flex items-center gap-2">
                    <Asterisk className="w-5 h-5 text-blue-600 animate-pulse" strokeWidth={3} />
                    <Asterisk className="w-5 h-5 text-blue-600 animate-pulse" strokeWidth={3} style={{ animationDelay: '0.2s' }} />
                    <Asterisk className="w-5 h-5 text-blue-600 animate-pulse" strokeWidth={3} style={{ animationDelay: '0.4s' }} />
                </div>
                <div className="flex-1">
                    <h3 className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                        Studio Mode
                    </h3>
                    <p className="text-xs text-muted-foreground">
                        {pinnedSource.name}
                    </p>
                </div>
            </div>

            {/* Preview Content */}
            <ScrollArea className="flex-1 p-4">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                        <p className="text-sm text-muted-foreground">
                            Analisi documento in corso...
                        </p>
                    </div>
                ) : preview ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                        <div className="whitespace-pre-wrap text-sm leading-relaxed">
                            {preview}
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full">
                        <p className="text-sm text-muted-foreground">
                            Nessuna preview disponibile
                        </p>
                    </div>
                )}
            </ScrollArea>

            {/* Footer with Actions */}
            {isPDF && (
                <div className="border-t px-4 py-3 bg-muted/20 flex-shrink-0">
                    <Button
                        onClick={compileForm}
                        disabled={isCompiling || isLoading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                        size="sm"
                    >
                        {isCompiling ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Compilazione in corso...
                            </>
                        ) : (
                            <>
                                <FileEdit className="w-4 h-4 mr-2" />
                                Compila Form
                            </>
                        )}
                    </Button>
                </div>
            )}
        </Card>
    );
}
