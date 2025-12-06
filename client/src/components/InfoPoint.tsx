import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface InfoPointProps {
    content: string;
    className?: string;
    side?: "top" | "right" | "bottom" | "left";
}

export function InfoPoint({ content, className = "", side = "top" }: InfoPointProps) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div
                    className={`
            inline-flex items-center justify-center 
            w-5 h-5 rounded-md 
            bg-muted/50 hover:bg-muted 
            border border-transparent hover:border-border
            transition-colors cursor-default 
            ${className}
          `}
                >
                    <Info className="w-3 h-3 text-muted-foreground" />
                </div>
            </TooltipTrigger>
            <TooltipContent side={side}>
                <p className="max-w-xs text-xs">{content}</p>
            </TooltipContent>
        </Tooltip>
    );
}
