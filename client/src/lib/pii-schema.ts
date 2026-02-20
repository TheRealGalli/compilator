/**
 * PII Schema Definition for AI Models
 * 
 * Provides a rigorous classification of personal data types to support 
 * identification and pseudonymization processes.
 * 
 * NOTE: Examples have been explicitly removed to prevent "few-shot" hallucinations 
 * where the model might output the example value instead of the real value.
 * 
 * Category names are kept SHORT and GENERIC for maximum model compatibility.
 */

export const PII_SCHEMA_DEFINITIONS = `
LEGENDA TIPI DI DATO (CLASSIFICAZIONE RIGOROSA):
Usa ESATTAMENTE questi token per classificare i dati trovati.

1. [NOME]: Nome e cognome di una persona fisica.
2. [DATA_NASCITA]: Data di nascita. (Formato: GG/MM/AAAA o AAAA-MM-DD)
3. [LUOGO_NASCITA]: Città e nazione di nascita.
4. [SESSO]: Sesso biologico o genere.
5. [NAZIONALITA]: Nazionalità della persona.
6. [CODICE_FISCALE]: Codice Fiscale italiano (16 caratteri alfanumerici).
7. [DOCUMENTO]: Numero di un documento di identità (Carta d'identità, Passaporto, Patente).
8. [INDIRIZZO]: Indirizzo di residenza completo (Via/Piazza, N°, CAP, Città, Nazione).
9. [CONTATTO]: Indirizzo email o numero di telefono personale.
10. [DATI_BIOMETRICI]: Caratteristiche fisiche per identificazione univoca.
11. [DATI_GENETICI]: Informazioni ereditarie da analisi biologiche.
12. [DATI_SALUTE]: Stato di salute, diagnosi, terapie, farmaci.
13. [OPINIONI_POLITICHE]: Opinioni politiche o affiliazioni partitiche.
14. [CONVINZIONI_RELIGIOSE]: Convinzioni religiose o filosofiche.
15. [SINDACATO]: Appartenenza a un sindacato.
16. [ORIENTAMENTO_SESSUALE]: Orientamento sessuale.
17. [DATI_COMPORTAMENTALI]: Informazioni per profilazione (cronologia acquisti, navigazione).
18. [DATI_FINANZIARI]: Situazione economica, reddito, affidabilità creditizia.
19. [RUOLO]: Titolo lavorativo o posizione professionale.
20. [PARTITA_IVA]: Numero di Partita IVA (11 cifre).
`;
