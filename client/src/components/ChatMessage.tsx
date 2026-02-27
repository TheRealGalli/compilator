import { Bot, User, Copy, FilePlus, Asterisk, Code, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FormattedMessage } from "./FormattedMessage";
import { useToast } from "@/hooks/use-toast";
import { useSources } from "@/contexts/SourcesContext";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface ChatMessageProps {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  sources?: string[];
  audioUrl?: string;
  groundingMetadata?: any;
  searchEntryPoint?: string;
  userInitial?: string;
  shortTitle?: string;
  aiMetadata?: {
    codeExecutionResults?: Array<{ code: string; output: string }>;
  };
}

export function ChatMessage({
  role,
  content,
  timestamp = "Ora",
  sources = [],
  audioUrl,
  groundingMetadata,
  searchEntryPoint,
  userInitial,
  shortTitle,
  aiMetadata,
  avatarUrl
}: ChatMessageProps & { avatarUrl?: string }) {
  const { toast } = useToast();
  const { addSource } = useSources();
  const isUser = role === "user";
  const [isSpinning, setIsSpinning] = useState(false);
  const [isCodeExpanded, setIsCodeExpanded] = useState(false);

  const handleIconClick = () => {
    setIsSpinning(true);
    setTimeout(() => setIsSpinning(false), 1000);
  };

  const handleAddAsSource = async () => {
    try {
      // Create a unique filename based on short title or time
      const sanitizedTitle = shortTitle
        ? shortTitle.replace(/[^a-z0-9]/gi, '_').substring(0, 30)
        : `AI_Response_${Date.now()}`;
      const fileName = `${sanitizedTitle}.txt`;
      const file = new File([content], fileName, { type: "text/plain" });
      const result = await addSource(file);

      if (result === 'success') {
        toast({
          title: "Aggiunto alle fonti",
          description: `La risposta è stata salvata come "${fileName}".`,
        });
      } else if (result === 'invalid_format') {
        toast({
          title: "Formato non supportato",
          description: "La risposta non può essere salvata in questo formato.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Impossibile aggiungere",
          description: result === 'limit_reached' ? "Limite fonti raggiunto." : "Errore durante il salvataggio.",
          variant: "destructive",
        });
      }
    } catch (e) {
      console.error("Error adding source:", e);
    }
  };

  return (
    <div className={`flex w-full gap-3 ${isUser ? "justify-end" : "justify-start"} group mb-1`}>
      {!isUser && (
        <div
          className="w-8 h-8 flex items-center justify-center flex-shrink-0 cursor-pointer"
          onClick={handleIconClick}
          title="Gromit AI"
        >
          <Asterisk
            className={`w-6 h-6 text-blue-600 transition-transform duration-1000 ${isSpinning ? 'rotate-[360deg]' : ''}`}
            strokeWidth={3}
          />
        </div>
      )}

      <div className={`flex flex-col ${isUser ? "items-end" : "items-start"} max-w-[80%] md:max-w-[70%] lg:max-w-[650px]`}>
        <div className={`rounded-lg p-4 shadow-sm relative break-words overflow-hidden w-full ${isUser ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
          {audioUrl ? (
            <div className="flex flex-col gap-2">
              <span className="text-xs opacity-70 flex items-center gap-1">🎤 Messaggio Vocale</span>
              <audio controls src={audioUrl} className="h-8 max-w-[200px]" />
            </div>
          ) : isUser ? (
            <p className="text-sm whitespace-pre-wrap" data-testid={`text-message-${role}`}>{content}</p>
          ) : (
            <FormattedMessage content={content} className="text-sm" data-testid={`text-message-${role}`} />
          )}
        </div>

        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-muted-foreground">{timestamp}</span>
          <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="icon"
              variant="ghost"
              className="w-6 h-6"
              data-testid="button-copy-message"
              onClick={() => {
                navigator.clipboard.writeText(content);
                toast({
                  description: "Messaggio copiato negli appunti",
                  duration: 2000,
                });
              }}
            >
              <Copy className="w-3 h-3" />
            </Button>
            {!isUser && (
              <Button
                size="icon"
                variant="ghost"
                className="w-6 h-6 ml-1"
                data-testid="button-add-source"
                onClick={handleAddAsSource}
                title="Usa come fonte"
              >
                <FilePlus className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>

        {sources.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {sources.map((source, i) => (
              <Badge key={i} variant="outline" className="text-xs" data-testid={`badge-source-${i}`}>
                {source}
              </Badge>
            ))}
          </div>
        )}

        {/* Grounding Sources (Google Search) */}
        {groundingMetadata?.groundingChunks && groundingMetadata.groundingChunks.length > 0 && (
          <div className="mt-4 border-t pt-3 w-full">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-2">Fonti di Ricerca</span>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {groundingMetadata.groundingChunks.map((chunk: any, i: number) => (
                <a
                  key={i}
                  href={chunk.web?.uri || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 group/link"
                >
                  <div className="w-4 h-4 flex items-center justify-center rounded-sm bg-blue-50 text-[9px] font-bold text-blue-600 border border-blue-100 group-hover/link:bg-blue-100 transition-colors">
                    {i + 1}
                  </div>
                  <span className="text-[11px] text-blue-600 font-medium hover:underline line-clamp-1 max-w-[200px]">
                    {chunk.web?.title || 'Fonte Web'}
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* AI Metadata Badge (Code Execution) */}
        {aiMetadata?.codeExecutionResults && aiMetadata.codeExecutionResults.length > 0 && (
          <div className="mt-3 border-t pt-3 w-full">
            <button
              onClick={() => setIsCodeExpanded(!isCodeExpanded)}
              className="flex items-center gap-1.5 group/exec cursor-pointer hover:opacity-80 transition-opacity"
            >
              <div className="w-4 h-4 flex items-center justify-center rounded-sm bg-violet-50 border border-violet-200">
                <Code className="w-2.5 h-2.5 text-violet-600" />
              </div>
              <span className="text-[10px] font-semibold text-violet-600 uppercase tracking-wider">
                Code Execution · {aiMetadata.codeExecutionResults.length} blocco{aiMetadata.codeExecutionResults.length > 1 ? 'hi' : ''}
              </span>
              {isCodeExpanded
                ? <ChevronUp className="w-3 h-3 text-violet-400" />
                : <ChevronDown className="w-3 h-3 text-violet-400" />
              }
            </button>
            {isCodeExpanded && (
              <div className="mt-2 space-y-2">
                {aiMetadata.codeExecutionResults.map((exec, i) => (
                  <div key={i} className="rounded-md border border-violet-100 bg-violet-50/50 overflow-hidden">
                    {exec.code && (
                      <pre className="text-[10px] text-violet-800 p-2 overflow-x-auto font-mono leading-relaxed">
                        <code>{exec.code}</code>
                      </pre>
                    )}
                    {exec.output && (
                      <div className="border-t border-violet-100 bg-violet-50 p-2">
                        <span className="text-[9px] text-violet-500 font-semibold uppercase">Output:</span>
                        <pre className="text-[10px] text-violet-700 mt-0.5 font-mono whitespace-pre-wrap">{exec.output}</pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {isUser && (
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden ${avatarUrl ? "bg-transparent" : userInitial ? "bg-blue-100 text-blue-700 font-bold" : "bg-secondary"}`}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="User Avatar" className="w-full h-full object-cover" />
          ) : userInitial ? userInitial : <User className="w-4 h-4" />}
        </div>
      )}
    </div>
  );
}
