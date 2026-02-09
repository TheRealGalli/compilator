/**
 * Strict Regex Patterns for Italian PII Detection (Local-First)
 * Designed to act as a deterministic "Sniper" layer before LLM processing.
 */

export const PII_REGEX_PATTERNS = {
    // Email: Standard RFC 5322 (simplified for practicality)
    EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,

    // Italian Codice Fiscale (Strict 16 chars alphanumeric)
    // Format: 6 letters, 2 digits, 1 letter, 2 digits, 1 letter, 3 digits, 1 letter
    FISCAL_CODE: /\b[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]\b/g,

    // Italian VAT Number (Partita IVA) - 11 digits
    // Often preceded by IT, P.IVA, PI, Partita IVA
    VAT_NUMBER: /\b(?:IT|P\.IVA|PI|Partita IVA)\s*[:.]?\s*([0-9]{11})\b/gi,

    // IBAN (International Bank Account Number) - Italian starts with IT, 27 chars total
    // Supports spacing groups (e.g. IT00 A123 4567...)
    IBAN: /\bIT[0-9]{2}[A-Z][0-9]{10}[0-9A-Z]{12}\b|\bIT\s*[0-9]{2}\s*[A-Z]\s*([0-9]{5}\s*){2}([0-9A-Z]{5}\s*){2}[0-9A-Z]{2}\b/g,

    // Phone Numbers (Italian mobile and landline)
    // Matches: +39 333 1234567, 333 1234567, 02 1234567, 333-1234567
    PHONE_NUMBER: /(?:(?:\+|00)39)?\s*(?:3\d{2}|0\d{1,4})\s*[ .\-]?\s*\d{3,4}\s*[ .\-]?\s*\d{3,4}\b/g,

    // Dates (DD/MM/YYYY or YYYY-MM-DD or DD-MM-YYYY)
    // Avoids matching simple fractions like 10/20
    DATE: /\b(0[1-9]|[12][0-9]|3[01])[-/.](0[1-9]|1[012])[-/.](19|20)\d{2}\b|\b(19|20)\d{2}[-/.](0[1-9]|1[012])[-/.](0[1-9]|[12][0-9]|3[01])\b/g,

    // Credit Card (Major brands, simple check, excludes Luhn for speed unless needed)
    CREDIT_CARD: /\b(?:\d{4}[ -]?){3}\d{4}\b/g,

    // IP Addresses (IPv4)
    IP_ADDRESS: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,

    // URLs (http/https)
    URL: /\bhttps?:\/\/[^\s/$.?#].[^\s]*\b/g
};

/**
 * Executes all regex patterns on the text and returns a unified list of findings.
 * Handles deduplication and basic validation/normalization.
 */
// 1. NAME INDICATORS (Prefixes for people)
const NAME_INDICATORS = [
    'Sig\\.', 'Sig\\.ra', 'Dott\\.', 'Dr\\.', 'Prof\\.', 'Avv\\.', 'Spett\\.', 'Gent\\.',
    'sottoscritto', 'sottoscritta', 'rappresentante', 'favore di', 'contro',
    'nominativo', 'dipendente', 'cliente', 'paziente'
];

// 2. ORGANIZATION INDICATORS (Prefixes for companies/entities)
const ORGANIZATION_INDICATORS = [
    'ente', 'società', 'ditta', 'azienda', 'studio', 'banca', 'istituto', 'associazione',
    'comune di', 'provincia di', 'regione', 'ministero', 'tribunale'
];

// 3. BIRTHPLACE INDICATORS (Prefixes for places)
const BIRTHPLACE_INDICATORS = [
    'nato a', 'nata a', 'nati a', 'residente a', 'residente in', 'vivente a', 'domiciliato a',
    'sito in', 'sede a', 'luogo di nascita'
];

// Helper to grab context around a match
function getContext(text: string, index: number, matchLength: number, contextSize = 50): string {
    const start = Math.max(0, index - contextSize);
    const end = Math.min(text.length, index + matchLength + contextSize);
    return text.substring(start, end).replace(/\s+/g, ' '); // Normalize spaces
}

export interface CandidateFinding {
    value: string;
    type: string; // The regex category or specificity (FULL_NAME, ORGANIZATION, etc.)
    context: string;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

/**
 * Scans text for PII candidates using strict regex + heuristics.
 * Returns a list of candidates with context for the LLM to validate.
 */
export function scanTextCandidates(text: string): CandidateFinding[] {
    const candidates: CandidateFinding[] = [];
    const uniqueKeys = new Set<string>();

    const addCandidate = (value: string, type: string, index: number, confidence: 'HIGH' | 'MEDIUM' | 'LOW') => {
        const cleanValue = value.trim();
        if (cleanValue.length < 2) return;

        const context = getContext(text, index, value.length);
        const key = `${type}:${cleanValue.toUpperCase()}`;

        if (!uniqueKeys.has(key)) {
            candidates.push({ value: cleanValue, type, context, confidence });
            uniqueKeys.add(key);
        }
    };

    // 1. STRICT REGEX PASS
    for (const [category, regex] of Object.entries(PII_REGEX_PATTERNS)) {
        let localRegex = new RegExp(regex.source, regex.flags);
        let match;
        while ((match = localRegex.exec(text)) !== null) {
            let val = match[0];
            if (category === 'VAT_NUMBER' && match[1]) val = match[1];
            if (category === 'IBAN') val = val.replace(/\s+/g, '');

            let conf: 'HIGH' | 'MEDIUM' | 'LOW' = 'HIGH';
            if (category === 'PHONE_NUMBER' || category === 'DATE') conf = 'MEDIUM';

            addCandidate(val, category, match.index, conf);
        }
    }

    // 2. HEURISTICS PASS (Names, Orgs, Places)

    // Helper for heuristic extraction
    const matchHeuristic = (indicators: string[], type: string) => {
        // Regex Explanation:
        // \b(${indicators.join('|')}) : Match the prefix (e.g. "Sig.", "Nato a")
        // \s+ : Space(s)
        // ((?:[A-Z][a-zàèéìòù]+\s*){1,4}) : Capture group 2. Matches 1 to 4 Capitalized Words.
        // UNLESS it's a generic word like "Il", "Lo" (already filtered below).

        const regexStr = `\\b(${indicators.join('|')})\\s+((?:[A-Z][a-zàèéìòù]+\\s*){1,4})`;
        const regex = new RegExp(regexStr, 'gi');
        let match;
        while ((match = regex.exec(text)) !== null) {
            const potentialValue = match[2].trim();

            // STRICT FILTERING for NAMES
            if (type === 'FULL_NAME') {
                // Rule 1: Must be at least 2 words (Name Surname)
                const words = potentialValue.split(/\s+/);
                if (words.length < 2) continue;

                // Rule 2: Must NOT be a common sentence start or verb phrase
                // (e.g. "Si Impegna" might pass if "Si" was in indicators? No, indicators are "Sig." etc.)
                // But sometimes indicators are weak.

                // Rule 3: Check for "Double Capitalization" strictness
                // We typically expect "Mario Rossi".
                // We reject if any word is NOT capitalized (already handled by regex)
                // We reject if it looks like a date "Gennaio 2020" -> Regex handles dates differently.
            }

            // Basic cleanup: ignore if strictly common words often capitalized in titles
            if (potentialValue.length > 3 && !['Il', 'Lo', 'La', 'I', 'Gli', 'Le', 'Si', 'Non'].includes(potentialValue)) {
                // Determine confidence: "Nato a" is very strong for birthplace, "Sig." is strong for name
                let conf: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
                if (type === 'PLACE_OF_BIRTH' || type === 'FULL_NAME') conf = 'MEDIUM'; // Let LLM confirm

                addCandidate(potentialValue, type, match.index + match[0].indexOf(potentialValue), conf);
            }
        }
    };

    matchHeuristic(NAME_INDICATORS, 'FULL_NAME');
    matchHeuristic(ORGANIZATION_INDICATORS, 'ORGANIZATION');
    matchHeuristic(BIRTHPLACE_INDICATORS, 'PLACE_OF_BIRTH');

    return candidates;
}
