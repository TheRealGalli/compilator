import { MessageSquare } from "lucide-react";
import { Button } from "./ui/button";

interface MentionButtonProps {
    onClick: () => void;
}

export function MentionButton({ onClick }: MentionButtonProps) {
    return (
        <div className="flex items-center bg-indigo-600 border border-indigo-400/30 rounded-lg shadow-xl p-0.5 animate-in fade-in zoom-in duration-200">
            <Button
                variant="ghost"
                size="sm"
                className="h-7 px-3 text-white hover:text-white hover:bg-white/10 text-[11px] font-medium border-0 rounded-md flex items-center gap-1.5"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onClick();
                }}
            >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Menziona</span>
                <span className="text-[9px] opacity-70 font-mono ml-1">⌘L</span>
            </Button>
        </div>
    );
}
