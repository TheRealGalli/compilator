import { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface PdfPreviewProps {
    fileBase64: string;
    className?: string;
}

export function PdfPreview({ fileBase64, className }: PdfPreviewProps) {
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!fileBase64) return;

        try {
            // Strip data URL prefix if present
            const base64Data = fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64;

            // Convert base64 to Blob
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'application/pdf' });

            // Create Blob URL
            const url = URL.createObjectURL(blob);
            setBlobUrl(url);
            setIsLoading(false);

            // Cleanup on unmount or file change
            return () => {
                URL.revokeObjectURL(url);
            };
        } catch (error) {
            console.error("Error creating PDF blob:", error);
            setIsLoading(false);
        }
    }, [fileBase64]);

    return (
        <Card className={`relative flex flex-col h-full bg-muted/20 border-none overflow-hidden ${className}`}>
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-50">
                    <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                        <span className="text-sm font-medium">Caricamento Viewer Nativo...</span>
                    </div>
                </div>
            )}

            {!blobUrl && !isLoading && (
                <div className="flex-1 flex items-center justify-center p-4 text-center text-muted-foreground">
                    Nessun documento PDF disponibile.
                </div>
            )}

            {blobUrl && (
                <iframe
                    src={`${blobUrl}#toolbar=1&navpanes=0&view=FitH`}
                    className="w-full h-full border-none bg-slate-100 dark:bg-slate-900/50"
                    title="PDF Preview"
                />
            )}
        </Card>
    );
}
