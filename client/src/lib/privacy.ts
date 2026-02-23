import { extractPIILocal } from './ollama';

/**
 * Performs a purely mechanical replacement of sensitive values with tokens.
 * Based on the "Global Sweep" strategy to ensure 100% consistency.
 * NOW ROBUST: Handles "spaced out" values (e.g. "G A L L I") and case-insensitivity.
 * STRICT BOUNDARIES: Uses \\b to avoid partial matches (e.g. GALLI inside GALLIPOLI).
 * WHITESPACE AGNOSTIC FIX: Matches "Carlo Galli" even if text is "Carlo\\nGalli".
 */
export const performMechanicalGlobalSweep = (text: string, vault: Record<string, string> | [string, string][]): string => {
    if (!text) return text;
    const entries = Array.isArray(vault) ? vault : Object.entries(vault);
    if (entries.length === 0) return text;

    let result = text;
    // Order by value length descending to avoid partial matches
    // entry[1] is the value to find
    const initialEntries = Array.isArray(vault) ? [...vault] : Object.entries(vault);

    // AGGRESSIVE: If a value has multiple words (e.g. "Mario Rossi"), 
    // we should ALSO censor individual words (if > 2 chars) to avoid leaks.
    const expandedEntries: [string, string][] = [];
    for (const [token, value] of initialEntries) {
        if (!value || value.length < 2) continue;
        expandedEntries.push([token, value]);

        // Skip common short street types or noise if possible, but keep it simple for now as per user request
        if (value.includes(' ')) {
            const parts = value.split(/[\s\/]+/).filter(p => p.length > 2);
            for (const part of parts) {
                // Only add if not already present as a full value tracking to the same or different token
                if (!expandedEntries.some(e => e[1].toLowerCase() === part.toLowerCase())) {
                    expandedEntries.push([token, part]);
                }
            }
        }
    }

    const sortedEntries = expandedEntries.sort((a, b) => b[1].length - a[1].length);

    for (const [token, value] of sortedEntries) {

        // STRIP ALL WHITESPACE from the value to match characters regardless of spacing in the source
        // e.g. "Carlo Galli" -> "CarloGalli" (chars) -> C[\s...]*a[\s...]*r...
        const cleanValue = value.replace(/\s+/g, '');
        const chars = cleanValue.split('');
        const escapedChars = chars.map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

        // Allow any whitespace (spaces, tabs, newlines) or common separators between characters
        // This handles "Carlo Galli" matching "Carlo\nGalli" or "Carlo  Galli"
        // Also handles "spaced out" chars like "G A L L I"
        const separator = '[\\s\\/\\.\\-]*';

        // We need to match the value, but if the value itself has spaces (e.g. "Carlo Galli"),
        // we want to allow those spaces to be ANY whitespace in the target text.
        // So we effectively replace every character in the search string with "char + optional separators".
        const mainPattern = escapedChars.join(separator);

        // SMART BOUNDARIES:
        // Only apply \\b if the value starts/ends with a word character.
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

    // CLEANUP: Repair "split" or "broken" tokens often returned by LLMs (e.g. [NOME _1] or [NOME\n_1])
    let result = text.replace(/\[\s*([A-Z_]+)\s*(_\d+)\s*\]/g, '[$1$2]');

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
