
// Mocking necessary parts of ollama.ts logic to test extraction
function extractJsonFromResponse(text) {
    const results = [];
    const tryParse = (str) => {
        try {
            const parsed = JSON.parse(str);
            if (Array.isArray(parsed)) results.push(...parsed);
            else if (typeof parsed === 'object' && parsed !== null) results.push(parsed);
        } catch (e) { }
    };

    try {
        const direct = JSON.parse(text);
        if (Array.isArray(direct)) return direct;
        if (typeof direct === 'object' && direct !== null) return [direct];
        return [];
    } catch (e) {
        let depthArr = 0, depthObj = 0;
        let startArr = -1, startObj = -1;
        for (let i = 0; i < text.length; i++) {
            if (text[i] === '[') { if (depthArr === 0) startArr = i; depthArr++; }
            else if (text[i] === ']') { depthArr--; if (depthArr === 0 && startArr !== -1) { tryParse(text.substring(startArr, i + 1)); startArr = -1; } }
            else if (text[i] === '{') { if (depthObj === 0) startObj = i; depthObj++; }
            else if (text[i] === '}') { depthObj--; if (depthObj === 0 && startObj !== -1) { tryParse(text.substring(startObj, i + 1)); startObj = -1; } }
        }
        return results;
    }
}

function normalizeFindings(input) {
    if (!input) return [];
    if (Array.isArray(input)) {
        return input.map(item => {
            if (typeof item === 'string') return item;
            if (typeof item === 'object' && item !== null) {
                const val = item.value || item.val || item.content;
                const cat = item.category || item.type || item.label || 'GENERIC_PII';
                if (val) return { value: String(val), category: String(cat), label: String(cat) };
            }
            return null;
        }).filter(Boolean);
    }
    return [];
}

// THE NEW LOGIC TO TEST
function testExtraction(rawResponse) {
    const findings = [];
    const jsonRaw = extractJsonFromResponse(rawResponse);
    const jsonResult = normalizeFindings(jsonRaw);

    if (Array.isArray(jsonResult) && jsonResult.length > 0) {
        for (const item of jsonResult) {
            if (typeof item === 'object' && item !== null) {
                // LOGICA NUOVA: Bypassa parseLine
                const val = String(item.value || item.val || '').trim();
                const rawCat = String(item.category || item.type || item.label || 'GENERIC_PII').toUpperCase();

                if (val && val.length >= 2) {
                    findings.push({
                        value: val,
                        category: rawCat.replace(/[^A-Z_]/g, '_'),
                        label: item.category || item.type || item.label || rawCat
                    });
                }
            }
        }
    }
    return findings;
}

// SAMPLE DATA FROM USER LOGS
const sample1 = `[
  {"category":"[NOME]","value":"GALLI CARLO"},
  {"category":"[DATA_NASCITA]","value":"15/06/2003"},
  {"category":"[LUOGO_NASCITA]","value":"SIENA (SI)"},
  {"category":"[INDIRIZZO]","value":"COLLE DI VAL D'ELSA (SI) VIA FRANCESCO CAMPANA 45 CAP 53034"},
  {"category":"[CONTATTO]","value":"carlogalli03@postecertifica.it"},
  {"category":"[CODICE_FISCALE]","value":"GLLCRL03H15I726Y"},
  {"category":"[PARTITA_IVA]","value":"01630510525"},
  {"category":"[RUOLO]","value":"Titolare Firmatario"},
  {"category":"GENERIC_PII","value":"REA 225553"}
]`;

const results = testExtraction(sample1);
console.log("Extraction Results:");
results.forEach(f => console.log(`- [${f.category}] (${f.label}): ${f.value}`));

const expectedFields = [
    'GALLI CARLO',
    '15/06/2003',
    'COLLE DI VAL D\'ELSA (SI) VIA FRANCESCO CAMPANA 45 CAP 53034',
    '01630510525'
];

const missing = expectedFields.filter(ef => !results.some(r => r.value === ef));

if (missing.length === 0) {
    console.log("\n✅ SUCCESS: All expected fields extracted!");
} else {
    console.log("\n❌ FAILURE: Missing fields:", missing);
    process.exit(1);
}
