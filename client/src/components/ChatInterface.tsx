import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessage } from "./ChatMessage";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  sources?: string[];
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: "Hello! I'm your AI research assistant. I can help you analyze your documents, answer questions, and generate insights. What would you like to know?",
      timestamp: "Just now",
    },
  ]);
  const [input, setInput] = useState("");

  const suggestedPrompts = [
    "Summarize the key points",
    "What are the main findings?",
    "Generate study notes",
    "Create a FAQ",
  ];

  const handleSend = () => {
    if (!input.trim()) return;
    
    const newMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: "Just now",
    };
    
    setMessages([...messages, newMessage]);
    setInput("");
    
    setTimeout(() => {
      const response: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "I understand your question. Based on the uploaded documents, here's what I found...",
        timestamp: "Just now",
        sources: ["research-paper.pdf"],
      };
      setMessages((prev) => [...prev, response]);
    }, 1000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 p-6">
        <div className="space-y-6 max-w-3xl mx-auto">
          {messages.map((message) => (
            <ChatMessage key={message.id} {...message} />
          ))}
        </div>
      </ScrollArea>

      <div className="border-t bg-background p-4">
        <div className="max-w-3xl mx-auto">
          {messages.length === 1 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {suggestedPrompts.map((prompt, i) => (
                <Badge
                  key={i}
                  variant="secondary"
                  className="cursor-pointer hover-elevate active-elevate-2"
                  onClick={() => setInput(prompt)}
                  data-testid={`badge-prompt-${i}`}
                >
                  {prompt}
                </Badge>
              ))}
            </div>
          )}
          
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask a question about your documents..."
              className="resize-none min-h-[60px]"
              data-testid="input-chat"
            />
            <Button 
              size="icon" 
              onClick={handleSend}
              disabled={!input.trim()}
              data-testid="button-send-message"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
