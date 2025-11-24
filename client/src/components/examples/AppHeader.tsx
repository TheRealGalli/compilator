import { AppHeader } from "../AppHeader";
import { ThemeProvider } from "../ThemeProvider";

export default function AppHeaderExample() {
  return (
    <ThemeProvider>
      <AppHeader notebookTitle="My Research Notebook" />
    </ThemeProvider>
  );
}
