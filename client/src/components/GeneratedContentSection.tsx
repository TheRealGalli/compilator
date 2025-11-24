import { ContentCard } from "./ContentCard";
import { Sparkles, FileText, HelpCircle, Map } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

export function GeneratedContentSection() {
  const generatedContent = [
    {
      id: "1",
      title: "Summary",
      icon: <Sparkles className="w-4 h-4 text-primary" />,
      content: "This research explores the intersection of machine learning and climate science. The study demonstrates how neural networks can predict weather patterns with 23% higher accuracy than traditional models. Key innovations include a novel attention mechanism and multi-scale temporal analysis.",
    },
    {
      id: "2",
      title: "Study Notes",
      icon: <FileText className="w-4 h-4 text-primary" />,
      content: "• Machine learning improves weather prediction accuracy by 23%\n• Novel attention mechanism enables better feature extraction\n• Multi-scale temporal analysis captures both short and long-term patterns\n• Dataset comprises 10 years of global weather data\n• Model achieves state-of-the-art results on benchmark tests",
    },
    {
      id: "3",
      title: "FAQ",
      icon: <HelpCircle className="w-4 h-4 text-primary" />,
      content: "Q: What is the main contribution of this research?\nA: A novel neural network architecture for weather prediction with 23% improved accuracy.\n\nQ: What dataset was used?\nA: 10 years of global weather data from multiple sources.\n\nQ: How does it compare to existing methods?\nA: It outperforms traditional models and achieves state-of-the-art results.",
    },
  ];

  return (
    <div className="h-full flex flex-col p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Generated Content</h2>
        <Button variant="outline" data-testid="button-generate-all">
          <Sparkles className="w-4 h-4 mr-2" />
          Generate All
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-4 pr-4">
          {generatedContent.map((content) => (
            <ContentCard
              key={content.id}
              title={content.title}
              icon={content.icon}
              content={content.content}
              onRegenerate={() => console.log(`Regenerate ${content.title}`)}
              onDownload={() => console.log(`Download ${content.title}`)}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
