import { AiService } from './ai';

async function testOllama() {
    const aiService = new AiService('test-project');
    const vault = new Map<string, string>();

    const testText = "Ciao, sono l'ing. Carlo Galli. L'azienda CSD Station LLC si trova in 123 Florida St, Miami. La mia P.IVA è IT01234567890.";

    console.log("--- TEST OLLAMA SANITIZATION (GROMIT GUARDIAN) ---");
    console.log("Original Text:", testText);

    try {
        const anonymized = await aiService.anonymizeWithOllama(testText, vault);
        console.log("\nAnonymized Result:\n" + anonymized);
        console.log("\nVault Contents:", Object.fromEntries(vault));

        if (anonymized.includes("[NOME_PERSONA_")) {
            console.log("\n✅ SUCCESS: Ollama identified and tokenized sensitive data.");
        } else {
            console.log("\n⚠️ WARNING: Ollama didn't find specific tokens. check if 'ollama' is running and 'gemma3:1b' is pulled.");
        }
    } catch (err) {
        console.error("\n❌ ERROR: Could not connect to Ollama. Make sure it's running on port 11434.");
    }
}

testOllama();
