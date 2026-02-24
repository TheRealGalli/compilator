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

    // SMART WORD-SPLITTING: Split compound values to catch individual name parts (e.g. "QAMIL" from "QAMIL DULE")
    // BUT filter out common/short/noise words to avoid false positives (e.g. "Via", "STE", "LLC", "300")
    const STOP_WORDS = new Set([
        // Italian geo/address terms
        'via', 'viale', 'piazza', 'piazzale', 'corso', 'largo', 'strada', 'vicolo',
        'colle', 'della', 'delle', 'degli', 'nella', 'nelle', 'dello', 'dalla',
        'comune', 'provincia', 'regione', 'stato', 'citta', 'paese', 'localita',
        'piano', 'interno', 'scala', 'palazzina', 'snc',
        // English geo/address terms
        'street', 'avenue', 'road', 'drive', 'lane', 'boulevard', 'court', 'place',
        'north', 'south', 'east', 'west', 'suite', 'floor', 'unit', 'building',
        'city', 'state', 'county', 'town', 'village',
        'florida', 'california', 'texas', 'york', 'ohio', 'virginia', 'georgia',
        'petersburg', 'cincinnati',
        // Common legal/business terms
        'registered', 'agents', 'incorporated', 'corporation', 'company', 'limited',
        'association', 'foundation', 'group', 'partners', 'services',
        // Date/time words
        'january', 'february', 'march', 'april', 'june', 'july', 'august',
        'september', 'october', 'november', 'december',
        'lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato', 'domenica',
        'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
        'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
        // Common noise
        'codice', 'identificativo', 'valido', 'fino', 'data', 'numero', 'tipo',
        'nato', 'nata', 'residente', 'domiciliato', 'domiciliata',
        'iban', 'swift', 'bban', 'sepa', // Financial labels (not PII themselves)
        'lyon', 'remo', 'elsa', 'siena', 'roma', 'milano', 'napoli', 'torino', // Common city names/fragments
        'with', 'from', 'this', 'that', 'have', 'been', 'were', 'will', 'would',
        'could', 'should', 'about', 'after', 'before', 'between', 'under', 'over',
    ]);

    const initialEntries: [string, string][] = (Array.isArray(vault) ? [...vault] : Object.entries(vault))
        .filter(([_, value]) => value && value.length >= 2);

    // Expand multi-word values with SMART filtering
    const expandedEntries: [string, string][] = [];
    for (const [token, value] of initialEntries) {
        expandedEntries.push([token, value]); // Always keep the full value

        // Split compound values into individual words, but ONLY keep distinctive ones
        if (value.includes(' ') || value.includes(',')) {
            const parts = value.split(/[\s,\/]+/).filter(p => {
                const clean = p.replace(/[^a-zA-Z0-9\u00C0-\u024F]/g, ''); // Strip punctuation for check
                if (clean.length < 4) return false;              // Too short (Via, STE, LLC, NEW, ST., FL.)
                if (/^\d+$/.test(clean)) return false;            // Pure numbers (7901, 33702, 53034)
                if (STOP_WORDS.has(clean.toLowerCase())) return false; // Common stop words
                return true;
            });
            for (const part of parts) {
                const cleanPart = part.replace(/[,;.]$/, ''); // Remove trailing punctuation
                if (cleanPart.length >= 4 && !expandedEntries.some(e => e[1].toLowerCase() === cleanPart.toLowerCase())) {
                    expandedEntries.push([token, cleanPart]);
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

    // POST-SWEEP DEDUPLICATION: Merge adjacent identical tokens
    // e.g. "[NOME_1] [NOME_1]" or "[INDIRIZZO_1]\n[INDIRIZZO_1]" -> "[NOME_1]", "[INDIRIZZO_1]"
    // This is crucial because if we censor "Carlo Galli", "Carlo", and "Galli" all as [NOME_1],
    // the text "Carlo Galli" might become "[NOME_1] [NOME_1]" or even "[NOME_1] [NOME_1] [NOME_1]".
    // We use a regex backreference \1 to find consecutive identical tokens separated by whitespace or common punctuation.
    const tokenCollapseRegex = /(\[[A-Z_]+(?:\_\d+)?\])(?:[\s\r\n.,;:\-]*\1)+/g;
    let previousResult = "";
    while (result !== previousResult) {
        previousResult = result;
        result = result.replace(tokenCollapseRegex, '$1');
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
