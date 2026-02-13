/**
 * Strict Regex Patterns for Italian PII Detection (Local-First)
 * Designed to act as a deterministic "Sniper" layer before LLM processing.
 */

import { NAMES_SET, SURNAMES_SET } from './data/italian-dataset';

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

    // Phone Numbers (Italian mobile/landline + International)
    // Matches: +39..., 0039..., or standard Italian 333... 02...
    // Now includes generic international: Prefix (1-4 digits) + 9+ digits
    PHONE_NUMBER: /(?:(?:\+|00)\d{1,4}[\s.-]*\d{9,})|(?:(?:\+|00)39)?\s*(?:3\d{2}|0\d{1,4})\s*[ .\-]?\s*\d{3,4}\s*[ .\-]?\s*\d{3,4}\b/g,

    // Dates (DD/MM/YYYY or YYYY-MM-DD or DD-MM-YYYY)
    // Avoids matching simple fractions like 10/20
    DATE: /\b(0[1-9]|[12][0-9]|3[01])[-/.](0[1-9]|1[012])[-/.](19|20)\d{2}\b|\b(19|20)\d{2}[-/.](0[1-9]|1[012])[-/.](0[1-9]|[12][0-9]|3[01])\b/g,

    // Credit Card (Major brands, simple check, excludes Luhn for speed unless needed)
    CREDIT_CARD: /\b(?:\d{4}[ -]?){3}\d{4}\b/g,

    // IP Addresses (IPv4)
    IP_ADDRESS: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,

    // URLs (http/https)
    URL: /\bhttps?:\/\/[^\s/$.?#].[^\s]*\b/g,

    // US EIN (Employer Identification Number) - Format: XX-XXXXXXX (2 digits, dash, 7 digits)
    // Common in IRS forms (5472, W-9, etc.) e.g. 36-5157311
    US_EIN: /\b\d{2}-\d{7}\b/g,

    // US Date formats (MM/DD/YYYY or MM-DD-YYYY) - Common in US tax forms
    US_DATE: /\b(0[1-9]|1[012])[-/](0[1-9]|[12][0-9]|3[01])[-/](19|20)\d{2}\b/g
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

    // --- VALIDATION ALGORITHMS ---

    /**
     * Validates Italian Fiscal Code (Codice Fiscale) Control Character.
     */
    function isValidFiscalCode(cf: string): boolean {
        if (cf.length !== 16) return false;
        cf = cf.toUpperCase();
        const oddChars: { [key: string]: number } = {
            '0': 1, '1': 0, '2': 5, '3': 7, '4': 9, '5': 13, '6': 15, '7': 17, '8': 19, '9': 21,
            'A': 1, 'B': 0, 'C': 5, 'D': 7, 'E': 9, 'F': 13, 'G': 15, 'H': 17, 'I': 19, 'J': 21,
            'K': 2, 'L': 4, 'M': 18, 'N': 20, 'O': 11, 'P': 3, 'Q': 6, 'R': 8, 'S': 12, 'T': 14,
            'U': 16, 'V': 10, 'W': 22, 'X': 25, 'Y': 24, 'Z': 23
        };
        const evenChars: { [key: string]: number } = {
            '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
            'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4, 'F': 5, 'G': 6, 'H': 7, 'I': 8, 'J': 9,
            'K': 10, 'L': 11, 'M': 12, 'N': 13, 'O': 14, 'P': 15, 'Q': 16, 'R': 17, 'S': 18,
            'T': 19, 'U': 20, 'V': 21, 'W': 22, 'X': 23, 'Y': 24, 'Z': 25
        };

        let sum = 0;
        for (let i = 0; i < 15; i++) {
            const char = cf[i];
            if ((i + 1) % 2 !== 0) { // Odd positions (1st, 3rd...) -> Array index 0, 2...
                sum += oddChars[char] || 0;
            } else {
                sum += evenChars[char] || 0;
            }
        }
        const remainder = sum % 26;
        const checkChar = String.fromCharCode(65 + remainder);
        return checkChar === cf[15];
    }

    /**
     * Validates Credit Card numbers using Luhn Algorithm.
     */
    function isValidLuhn(number: string): boolean {
        let sum = 0;
        let shouldDouble = false;
        // Loop from right to left
        for (let i = number.length - 1; i >= 0; i--) {
            let digit = parseInt(number.charAt(i));
            if (shouldDouble) {
                if ((digit *= 2) > 9) digit -= 9;
            }
            sum += digit;
            shouldDouble = !shouldDouble;
        }
        return (sum % 10) == 0;
    }


    // 1. STRICT REGEX PASS
    for (const [category, regex] of Object.entries(PII_REGEX_PATTERNS)) {
        let localRegex = new RegExp(regex.source, regex.flags);
        let match;
        while ((match = localRegex.exec(text)) !== null) {
            let val = match[0];
            let cleanVal = val;

            if (category === 'VAT_NUMBER' && match[1]) {
                val = match[1];
                cleanVal = val;
            }
            if (category === 'IBAN') {
                cleanVal = val.replace(/\s+/g, '');
            }
            if (category === 'CREDIT_CARD') {
                cleanVal = val.replace(/[\s-]/g, '');
            }

            // ALGORITHMIC VALIDATION
            if (category === 'FISCAL_CODE' && !isValidFiscalCode(cleanVal)) continue;
            if (category === 'CREDIT_CARD' && !isValidLuhn(cleanVal)) continue;

            let conf: 'HIGH' | 'MEDIUM' | 'LOW' = 'HIGH';
            if (category === 'PHONE_NUMBER' || category === 'DATE' || category === 'US_DATE') conf = 'MEDIUM';
            if (category === 'US_EIN') conf = 'HIGH';

            addCandidate(val, category, match.index, conf);
        }
    }

    // --- HYBRID PII EXTRACTION (REGEX + DICTIONARY) ---



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
                const words = potentialValue.split(/\s+/).map(w => w.toUpperCase());

                // Rule 1: Must be at least 2 words (Name Surname)
                if (words.length < 2) continue;

                // Rule 2: Double Capitalization Strictness
                const isAllCapitalized = potentialValue.split(/\s+/).every(w => /^[A-ZÀÈÉÌÒÙ]/.test(w));
                if (!isAllCapitalized) continue;

                // Rule 3: Reject specific legal verbs/articles
                const forbiddenStarts = ['Si', 'Non', 'Vi', 'Ci', 'Le', 'Gli', 'Lo', 'Il', 'La', 'I', 'Che', 'Chi', 'Dichiara'];
                if (forbiddenStarts.some(f => potentialValue.startsWith(f))) continue;

                // Rule 4: DICTIONARY CHECK (The "Dopata" Strategy)
                // Check if at least ONE word is a known Name or Surname
                const hasKnownName = words.some(w => NAMES_SET.has(w));
                const hasKnownSurname = words.some(w => SURNAMES_SET.has(w));

                // If strictly "Si impegna", it won't be in the dictionary.
                // If "Mario Rossi", "MARIO" is in NAMES, "ROSSI" is in SURNAMES.
                if (!hasKnownName && !hasKnownSurname) {
                    // If it doesn't look like a name AND isn't in dictionary, be skeptical.
                    // But we keep it as LOW confidence for Ollama to decide, UNLESS it's a verb.
                    // User wants "Regex First" to be strict.
                    // Let's degrade confidence if not in dictionary.
                    // Actually, if we want "The Sniper", we might skip it if it's not in DB, 
                    // BUT 2000 names is small. Let's keep it but mark confidence.
                }
            }

            if (potentialValue.length > 3) {
                let conf: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';

                if (type === 'FULL_NAME') {
                    const words = potentialValue.toUpperCase().split(' ');
                    const nameMatch = words.some(w => NAMES_SET.has(w));
                    const surnameMatch = words.some(w => SURNAMES_SET.has(w));

                    if (nameMatch && surnameMatch) conf = 'HIGH'; // "Mario Rossi" (Both found)
                    else if (nameMatch || surnameMatch) conf = 'MEDIUM'; // "Mario Vattelapesca" (Name found)
                    else conf = 'LOW'; // "Pincopallo Vattelapesca" (Neither found)
                }

                if (type === 'PLACE_OF_BIRTH') conf = 'MEDIUM';

                addCandidate(potentialValue, type, match.index + match[0].indexOf(potentialValue), conf);
            }
        }
    };

    matchHeuristic(NAME_INDICATORS, 'FULL_NAME');
    matchHeuristic(ORGANIZATION_INDICATORS, 'ORGANIZATION');
    matchHeuristic(BIRTHPLACE_INDICATORS, 'PLACE_OF_BIRTH');

    // 3. DICTIONARY SWEEP (Find "Name Surname" anywhere)
    // This catches "Mario Rossi" even without "Sig." prefix.
    const words = text.split(/[\s,.:;()"]+/); // Tokenize
    for (let i = 0; i < words.length - 1; i++) {
        const w1 = words[i].toUpperCase();
        const w2 = words[i + 1].toUpperCase();

        // Check if bigram is Name + Surname
        if (NAMES_SET.has(w1) && SURNAMES_SET.has(w2)) {
            // Calculate approximate index (this is rough, but effective for finding candidates)
            // We can use the original text index if we want precision, but for scanning candidates:
            const originalSnippet = `${words[i]} ${words[i + 1]}`;

            // Check if it's already added (deduplication handles it)
            // Verify it's not a common false positive (e.g. "Che Rossi")
            if (w1.length > 2 && w2.length > 2) {
                // Search for the exact occurrence in text to get real index
                // Note: This scans text again, but ensures we get the real context.
                const regex = new RegExp(`\\b${w1}[\\s]+${w2}\\b`, 'gi');
                let match;
                while ((match = regex.exec(text)) !== null) {
                    addCandidate(match[0], 'FULL_NAME', match.index, 'HIGH');
                }
            }
        }
    }

    return candidates;
}
