import { Bot, User, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
  sources?: string[];
}

export function ChatMessage({ 
  role, 
  content, 
  timestamp = "Just now",
  sources = []
}: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"} group`}>
      {!isUser && (
        <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center flex-shrink-0">
          <Bot className="w-4 h-4 text-primary-foreground" />
        </div>
      )}
      
      <div className={`flex flex-col ${isUser ? "items-end" : "items-start"} max-w-[70%]`}>
        <div className={`rounded-lg p-4 ${isUser ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
          <p className="text-sm whitespace-pre-wrap" data-testid={`text-message-${role}`}>{content}</p>
        </div>
        
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-muted-foreground">{timestamp}</span>
          <Button 
            size="icon" 
            variant="ghost" 
            className="w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
            data-testid="button-copy-message"
          >
            <Copy className="w-3 h-3" />
          </Button>
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
      </div>

      {isUser && (
        <div className="w-8 h-8 bg-secondary rounded-md flex items-center justify-center flex-shrink-0">
          <User className="w-4 h-4" />
        </div>
      )}
    </div>
  );
}
