import { extractPIILocal } from './ollama';

/**
 * Performs a purely mechanical replacement of sensitive values with tokens.
 * Based on the "Global Sweep" strategy to ensure 100% consistency.
 * NOW ROBUST: Handles "spaced out" values (e.g. "G A L L I") and case-insensitivity.
 * STRICT BOUNDARIES: Uses \\b to avoid partial matches (e.g. GALLI inside GALLIPOLI).
 */
export const performMechanicalGlobalSweep = (text: string, vault: Record<string, string>): string => {
    if (!text || Object.keys(vault).length === 0) return text;
    let result = text;
    // Order by value length descending to avoid partial matches
    const sortedValues = Object.entries(vault).sort((a, b) => b[1].length - a[1].length);

    for (const [token, value] of sortedValues) {
        if (!value || value.length < 2) continue;

        const chars = value.split('');
        const escapedChars = chars.map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        // Allow spaces, slashes, dots, dashes between characters
        const separator = '[\\s\\/\\.\\-]*';
        // Use Word Boundaries \\b to ensure we match the exact word/value and not a substring
        const robustPattern = '\\b' + escapedChars.join(separator) + '\\b';

        // CRITICAL: Use 'gi' for Case-Insensitive Global replacement
        const regex = new RegExp(robustPattern, 'gi');

        // Check if replacement will happen (for logging)
        if (regex.test(result)) {
            console.log(`[Privacy] Censoring '${value}' -> '${token}'`);
            result = result.replace(regex, token);
        }
    }
    return result;
};

/**
 * Restores original values from tokens.
 */
export const performMechanicalReverseSweep = (text: string, vault: Record<string, string>): string => {
    if (!text || Object.keys(vault).length === 0) return text;
    let result = text;
    // Replaces tokens [CAT_X] with their values
    for (const [token, value] of Object.entries(vault)) {
        // Escape token for regex (they contain brackets [NAME_1])
        // We modify the regex to be lenient with spaces: \[ ?NAME_1 ?\]
        const coreToken = token.replace(/^\[|\]$/g, ''); // Extract 'NAME_1' from '[NAME_1]'
        // Regex: \[ \s* NAME_1 \s* \]
        const regex = new RegExp(`\\[\\s*${coreToken}\\s*\\]`, 'g');
        result = result.replace(regex, value);
    }
    return result;
};

/**
 * Anonymizes text using a local LLM/Regex hybrid approach updates the vault.
 */
export const anonymizeWithOllamaLocal = async (
    text: string,
    currentVault: Record<string, string>,
    modelId: string
): Promise<{ anonymized: string; newVault: Record<string, string> }> => {
    if (!text || text.trim() === "") return { anonymized: text, newVault: currentVault };

    try {
        const findings = await extractPIILocal(text, modelId);
        const vaultMap = new Map<string, string>(Object.entries(currentVault));

        for (const finding of findings) {
            const value = finding.value.trim();
            const category = finding.category.toUpperCase().replace(/\s+/g, '_');
            if (!value || value.length < 2) continue;

            let token = "";
            const normalizedValue = value.toLowerCase();
            for (const [t, v] of vaultMap.entries()) {
                if (v.toLowerCase() === normalizedValue && t.includes(category)) {
                    token = t;
                    break;
                }
            }

            if (!token) {
                let count = 0;
                for (const t of vaultMap.keys()) {
                    if (t.startsWith(`[${category}_`)) count++;
                }
                token = `[${category}_${count + 1}]`;
                vaultMap.set(token, value);
            }
        }

        const updatedVault = Object.fromEntries(vaultMap);
        return {
            anonymized: performMechanicalGlobalSweep(text, updatedVault),
            newVault: updatedVault
        };
    } catch (err) {
        console.error("[Privacy] Anonymization failed:", err);
        throw err;
    }
};
