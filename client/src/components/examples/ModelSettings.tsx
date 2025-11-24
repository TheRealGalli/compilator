import { ModelSettings } from "../ModelSettings";
import { useState } from "react";

export default function ModelSettingsExample() {
  const [notes, setNotes] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [webResearch, setWebResearch] = useState(false);
  const [detailedAnalysis, setDetailedAnalysis] = useState(true);
  const [formalTone, setFormalTone] = useState(true);

  return (
    <div className="h-screen p-8">
      <ModelSettings
        notes={notes}
        temperature={temperature}
        webResearch={webResearch}
        detailedAnalysis={detailedAnalysis}
        formalTone={formalTone}
        onNotesChange={setNotes}
        onTemperatureChange={setTemperature}
        onWebResearchChange={setWebResearch}
        onDetailedAnalysisChange={setDetailedAnalysis}
        onFormalToneChange={setFormalTone}
      />
    </div>
  );
}
