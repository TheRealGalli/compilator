import { ChatMessage } from "../ChatMessage";

export default function ChatMessageExample() {
  return (
    <div className="p-8 space-y-6 max-w-3xl">
      <ChatMessage 
        role="user"
        content="Can you summarize the main findings from the research paper?"
        timestamp="2 mins ago"
      />
      <ChatMessage 
        role="assistant"
        content="Based on the research paper, the main findings are:\n\n1. The study identified three key factors contributing to climate change\n2. Data shows a 15% increase in global temperatures over the past decade\n3. Recommendations include policy changes and renewable energy adoption"
        timestamp="1 min ago"
        sources={["research-paper.pdf", "notes.txt"]}
      />
    </div>
  );
}
