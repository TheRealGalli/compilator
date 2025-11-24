import { ContentCard } from "../ContentCard";
import { Sparkles } from "lucide-react";

export default function ContentCardExample() {
  return (
    <div className="p-8 space-y-4">
      <ContentCard 
        title="Summary"
        icon={<Sparkles className="w-4 h-4 text-primary" />}
        content="This research paper explores the impact of artificial intelligence on modern education systems. Key findings include improved student engagement through personalized learning paths and the importance of maintaining human oversight in AI-driven educational tools."
        onRegenerate={() => console.log("Regenerate clicked")}
        onDownload={() => console.log("Download clicked")}
      />
    </div>
  );
}
