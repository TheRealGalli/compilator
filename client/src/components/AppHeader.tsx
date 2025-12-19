import { useState } from "react";
import { Moon, Sun, User, Asterisk } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useTheme } from "./ThemeProvider";

interface AppHeaderProps {
  notebookTitle?: string;
  onHomeClick?: () => void;
}

export function AppHeader({ notebookTitle = "Notebook Senza Titolo", onHomeClick }: AppHeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const [isSpinning, setIsSpinning] = useState(false);

  const handleLogoClick = () => {
    setIsSpinning(true);
    if (onHomeClick) onHomeClick();
    setTimeout(() => setIsSpinning(false), 1000); // 1s spin animation
  };

  return (
    <header className="h-14 border-b bg-background flex items-center justify-between px-4 sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <div className="flex items-center -space-x-3 mr-2 cursor-pointer group" onClick={handleLogoClick}>
          <Asterisk
            className={`w-8 h-8 text-blue-600 transition-transform duration-1000 ${isSpinning ? 'rotate-[360deg]' : ''}`}
            strokeWidth={3}
          />
          <Asterisk className="w-8 h-8 text-blue-600" strokeWidth={3} />
        </div>
        <h1 className="text-lg font-semibold" data-testid="text-notebook-title">{notebookTitle}</h1>
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="icon"
          variant="ghost"
          onClick={toggleTheme}
          data-testid="button-toggle-theme"
        >
          {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </Button>

        <Avatar className="w-8 h-8" data-testid="avatar-user">
          <AvatarFallback>
            <User className="w-4 h-4" />
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
