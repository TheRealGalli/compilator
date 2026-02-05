import { Switch, Route, Router as WouterRouter } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { SourcesProvider } from "@/contexts/SourcesContext";
import Home from "@/pages/Home";
import NotFound from "@/pages/not-found";
import { MobileBlocker } from "@/components/MobileBlocker";
import { GmailProvider } from "@/contexts/GmailContext";
import { GoogleDriveProvider } from "@/contexts/GoogleDriveContext";
import { ChatProvider } from "@/contexts/ChatContext";
import { CompilerProvider } from "@/contexts/CompilerContext";
import { checkDeviceSync } from "@/utils/device";

// Ottieni il base path da import.meta.env.BASE_URL (impostato da Vite)
const basePath = import.meta.env.BASE_URL || '/';

function Router() {
  return (
    <WouterRouter base={basePath}>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </WouterRouter>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <GmailProvider>
        <SourcesProvider>
          <ChatProvider>
            <CompilerProvider>
              <GoogleDriveProvider>
                <TooltipProvider>
                  <ThemeProvider>
                    <Toaster />
                    <MobileBlocker />
                    {!checkDeviceSync() && <Router />}
                  </ThemeProvider>
                </TooltipProvider>
              </GoogleDriveProvider>
            </CompilerProvider>
          </ChatProvider>
        </SourcesProvider>
      </GmailProvider>
    </QueryClientProvider>
  );
}

export default App;
