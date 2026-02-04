import { MessageCircle } from "lucide-react";
import { Button } from "./ui/button";

interface MentionButtonProps {
    onClick: () => void;
}

export function MentionButton({ onClick }: MentionButtonProps) {
    return (
        <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg rounded-full flex items-center gap-1.5 px-3 py-1 animate-in fade-in zoom-in duration-200"
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClick();
            }}
        >
            <MessageCircle className="w-4 h-4" />
            <span className="text-xs font-semibold">Chiedi al Co-pilot</span>
        </Button>
    );
}
