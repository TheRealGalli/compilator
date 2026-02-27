import { useState } from "react";
import { User, Asterisk } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { ThreeStars } from "@/components/ui/three-stars";
import { useGoogleDrive } from "@/contexts/GoogleDriveContext";
import { useQuery } from "@tanstack/react-query";
import { type User as UserType } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

interface AppHeaderProps {
  notebookTitle?: string;
  onHomeClick?: () => void;
}

export function AppHeader({ notebookTitle = "Notebook Senza Titolo", onHomeClick }: AppHeaderProps) {
  const { data: user } = useQuery<UserType>({ queryKey: ['/api/user'] });
  const { userIdentity } = useGoogleDrive();
  const [isSpinning, setIsSpinning] = useState(false);

  const handleLogoClick = () => {
    setIsSpinning(true);
    if (onHomeClick) onHomeClick();
    setTimeout(() => setIsSpinning(false), 2000); // 2s smooth spin cycle
  };

  const handleLogout = async () => {
    try {
      await apiRequest('POST', '/api/auth/logout');
      // FALLBACK: Clear session ID from localStorage
      localStorage.removeItem('csd_sid');
      window.location.reload(); // Refresh to clear all state
    } catch (err) {
      console.error("Logout failed", err);
      // Even if API fails, clear local sid
      localStorage.removeItem('csd_sid');
      window.location.reload();
    }
  };

  return (
    <header className="h-14 border-b bg-background flex items-center justify-between px-4 sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <div className="flex items-center -space-x-3 mr-2 cursor-pointer group" onClick={handleLogoClick}>
          <Asterisk
            className={`text-blue-600 ${isSpinning ? 'animate-turbo-spin' : ''}`}
            width={32}
            height={32}
            strokeWidth={3}
          />
          <Asterisk className="text-blue-600" width={32} height={32} strokeWidth={3} />
        </div>
        <h1 className="text-lg font-semibold" data-testid="text-notebook-title">{notebookTitle}</h1>
      </div>

      <div className="flex items-center gap-2">

        {!!user && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-xs text-muted-foreground hover:text-red-600 hover:bg-red-50"
          >
            Esci
          </Button>
        )}

        <Avatar className="w-8 h-8" data-testid="avatar-user">
          {user?.avatarUrl ? (
            <AvatarImage src={user.avatarUrl} alt={user?.email || "User Avatar"} />
          ) : null}
          <AvatarFallback className={userIdentity ? "bg-blue-100 text-blue-700 font-bold" : ""}>
            {user?.avatarUrl ? null : userIdentity ? (userIdentity.initial as string) : <User className="w-4 h-4" />}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
