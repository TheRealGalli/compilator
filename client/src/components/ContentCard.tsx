import { RotateCw, Download, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { useState } from "react";

interface ContentCardProps {
  title: string;
  content: string;
  icon?: React.ReactNode;
  onRegenerate?: () => void;
  onDownload?: () => void;
}

export function ContentCard({ 
  title, 
  content, 
  icon,
  onRegenerate,
  onDownload 
}: ContentCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-semibold" data-testid={`text-card-title-${title}`}>{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            size="icon" 
            variant="ghost"
            onClick={onRegenerate}
            data-testid="button-regenerate"
          >
            <RotateCw className="w-4 h-4" />
          </Button>
          <Button 
            size="icon" 
            variant="ghost"
            onClick={onDownload}
            data-testid="button-download"
          >
            <Download className="w-4 h-4" />
          </Button>
          <Button 
            size="icon" 
            variant="ghost"
            onClick={() => setIsExpanded(!isExpanded)}
            data-testid="button-toggle-expand"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent>
          <div className="prose prose-sm max-w-none" data-testid="text-card-content">
            {content}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
