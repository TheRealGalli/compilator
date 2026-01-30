import { useState } from "react";
import { Moon, Sun, User, Asterisk } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useTheme } from "./ThemeProvider";
import { ThreeStars } from "@/components/ui/three-stars";
import { useGoogleDrive } from "@/contexts/GoogleDriveContext";

interface AppHeaderProps {
  notebookTitle?: string;
  onHomeClick?: () => void;
}

export function AppHeader({ notebookTitle = "Notebook Senza Titolo", onHomeClick }: AppHeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const { userIdentity } = useGoogleDrive();
  const [isSpinning, setIsSpinning] = useState(false);

  const handleLogoClick = () => {
    setIsSpinning(true);
    if (onHomeClick) onHomeClick();
    setTimeout(() => setIsSpinning(false), 1000); // 1s spin animation
  };

  return (
    <header className="h-14 border-b bg-background flex items-center justify-between px-4 sticky top-0 z-50">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 cursor-pointer" onClick={handleLogoClick}>
          <ThreeStars className="w-8 h-8 text-blue-500" />
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
            Gromit
          </h1>
        </div>
        {/* The notebook title is removed as per the provided edit, assuming the new h1 replaces it */}
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
          <AvatarFallback className={userIdentity ? "bg-blue-100 text-blue-700 font-bold" : ""}>
            {userIdentity ? userIdentity.initial : <User className="w-4 h-4" />}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
