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

        // Allow spaces, slashes, dots, dashes between characters to handle "spaced out" variations
        const separator = '[\\s\\/\\.\\-]*';
        const mainPattern = escapedChars.join(separator);

        // SMART BOUNDARIES:
        // Only apply \b if the value starts/ends with a word character.
        // E.g. "+39..." starts with +, so \b would fail if preceded by space (non-word).
        // "Mario" starts with M, so \b is good.
        const startBoundary = /^\w/.test(value) ? '\\b' : '';
        const endBoundary = /\w$/.test(value) ? '\\b' : '';

        const robustPattern = startBoundary + mainPattern + endBoundary;

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
 * NOW ROBUST: Handles Markdown bolding (**[TOKEN]**) and loose spacing ([ TOKEN ]).
 */
export const performMechanicalReverseSweep = (text: string, vault: Record<string, string>): string => {
    if (!text || Object.keys(vault).length === 0) return text;
    let result = text;

    // Sort vault by token length descending to avoid partial replacements if any overlap exists
    const sortedTokens = Object.entries(vault).sort((a, b) => b[0].length - a[0].length);

    for (const [token, value] of sortedTokens) {
        // Core token: 'NAME_1' from '[NAME_1]'
        const coreToken = token.replace(/^\[|\]$/g, '');

        // Regex Construction:
        // 1. Optional Markdown bolding: (\*\*|__)?
        // 2. Opening Bracket with optional space: \[\s*
        // 3. Core Token (exact match): coreToken
        // 4. Closing Bracket with optional space: \s*\]
        // 5. Evaluation of Markdown closing: \1 (backreference if supported) or just optional closing

        // Simplified Robust Regex: 
        // Matches: [NAME_1], **[NAME_1]**, [ NAME_1 ], ** [ NAME_1 ] **

        // Escape special chars in coreToken just in case
        const safeCore = coreToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        const regex = new RegExp(`(\\*\\*|__)?\\s*\\[\\s*${safeCore}\\s*\\]\\s*(\\*\\*|__)?`, 'g');

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
