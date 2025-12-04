import { Moon, Sun, Settings, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useTheme } from "./ThemeProvider";

interface AppHeaderProps {
  notebookTitle?: string;
}

export function AppHeader({ notebookTitle = "Notebook Senza Titolo" }: AppHeaderProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="h-14 border-b bg-background flex items-center justify-between px-4 sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <img src="/csd-station-logo.jpg" alt="CSD Station" className="w-8 h-8 rounded-md object-cover" />
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
        <Button size="icon" variant="ghost" data-testid="button-settings">
          <Settings className="w-4 h-4" />
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
