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
export function scanTextWithRegex(text: string): { value: string; category: string }[] {
    const findings: { value: string; category: string }[] = [];
    const uniqueValues = new Set<string>();

    for (const [category, regex] of Object.entries(PII_REGEX_PATTERNS)) {
        // Create a new RegExp object to ensure clean state and correct global execution
        let localRegex = new RegExp(regex.source, regex.flags);
        let match;

        while ((match = localRegex.exec(text)) !== null) {
            let extractedValue = match[0];

            // Special handling for capture groups
            if (category === 'VAT_NUMBER' && match[1]) {
                extractedValue = match[1]; // Capture just the digits if group present
            }
            if (category === 'IBAN') {
                extractedValue = extractedValue.replace(/\s+/g, ''); // Normalize IBAN removing spaces
            }
            if (category === 'PHONE_NUMBER') {
                // Ignore matches that are too short to be phone numbers
                if (extractedValue.replace(/\D/g, '').length < 8) continue;
            }

            const cleanValue = extractedValue.trim();
            const key = `${category}:${cleanValue.toUpperCase()}`;

            if (!uniqueValues.has(key)) {
                findings.push({ value: cleanValue, category });
                uniqueValues.add(key);
            }
        }
    }

    return findings;
}
