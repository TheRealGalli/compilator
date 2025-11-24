import { ContentCard } from "./ContentCard";
import { Sparkles, FileText, HelpCircle, Map } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

export function GeneratedContentSection() {
  const generatedContent = [
    {
      id: "1",
      title: "Riassunto",
      icon: <Sparkles className="w-4 h-4 text-primary" />,
      content: "Questa ricerca esplora l'intersezione tra machine learning e scienze climatiche. Lo studio dimostra come le reti neurali possano prevedere i modelli meteorologici con un'accuratezza superiore del 23% rispetto ai modelli tradizionali. Le innovazioni chiave includono un nuovo meccanismo di attenzione e un'analisi temporale multi-scala.",
    },
    {
      id: "2",
      title: "Note di Studio",
      icon: <FileText className="w-4 h-4 text-primary" />,
      content: "• Il machine learning migliora l'accuratezza delle previsioni meteo del 23%\n• Nuovo meccanismo di attenzione che consente una migliore estrazione delle caratteristiche\n• L'analisi temporale multi-scala cattura sia pattern a breve che a lungo termine\n• Il dataset comprende 10 anni di dati meteorologici globali\n• Il modello raggiunge risultati all'avanguardia nei test di benchmark",
    },
    {
      id: "3",
      title: "FAQ",
      icon: <HelpCircle className="w-4 h-4 text-primary" />,
      content: "D: Qual è il contributo principale di questa ricerca?\nR: Una nuova architettura di rete neurale per le previsioni meteorologiche con un'accuratezza migliorata del 23%.\n\nD: Quale dataset è stato utilizzato?\nR: 10 anni di dati meteorologici globali provenienti da più fonti.\n\nD: Come si confronta con i metodi esistenti?\nR: Supera i modelli tradizionali e raggiunge risultati all'avanguardia.",
    },
  ];

  return (
    <div className="h-full flex flex-col p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Contenuti Generati</h2>
        <Button variant="outline" data-testid="button-generate-all">
          <Sparkles className="w-4 h-4 mr-2" />
          Genera Tutto
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-4 pr-4">
          {generatedContent.map((content) => (
            <ContentCard
              key={content.id}
              title={content.title}
              icon={content.icon}
              content={content.content}
              onRegenerate={() => console.log(`Regenerate ${content.title}`)}
              onDownload={() => console.log(`Download ${content.title}`)}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
