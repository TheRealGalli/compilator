/**
 * PII Schema Definition for AI Models
 * 
 * Provides a rigorous classification of personal data types to support 
 * identification and pseudonymization processes.
 * 
 * NOTE: Examples have been explicitly removed to prevent "few-shot" hallucinations 
 * where the model might output the example value instead of the real value.
 */

export const PII_SCHEMA_DEFINITIONS = `
LEGENDA TIPI DI DATO (CLASSIFICAZIONE RIGOROSA):
Usa ESATTAMENTE questi token per classificare i dati trovati.

1. [NOME_PERSONA]: Nome e cognome di una persona fisica. (Formato: Stringa testuale)
2. [DATA_NASCITA]: Data di nascita. (Formato: GG/MM/AAAA o AAAA-MM-DD)
3. [LUOGO_NASCITA]: Città e nazione di nascita. (Formato: "Città, Nazione")
4. [SESSO]: Sesso biologico o genere.
5. [NAZIONALITA]: Nazionalità della persona.
6. [C_FISCALE_PERSONA]: Codice Fiscale italiano (16 caratteri alfanumerici).
7. [NUMERO_DOCUMENTO]: Numero di un documento di identità (Carta d'identità, Passaporto, Patente).
8. [INDIRIZZO_RESIDENZA]: Indirizzo di residenza completo (Via/Piazza, N°, CAP, Città, Nazione).
9. [CONTATTO_PERSONALE]: Indirizzo email o numero di telefono personale.
10. [DATI_BIOMETRICI]: Caratteristiche fisiche, fisiologiche o comportamentali per identificazione univoca.
11. [DATI_GENETICI]: Informazioni ereditarie o acquisite da analisi biologiche.
12. [DATI_SALUTE]: Informazioni sullo stato di salute fisica o mentale, diagnosi, terapie, farmaci.
13. [OPINIONI_POLITICHE]: Dati relativi alle opinioni politiche o affiliazioni partitiche.
14. [CONVINZIONI_RELIGIOSE]: Dati relativi alle convinzioni religiose o filosofiche.
15. [APPARTENENZA_SINDACALE]: Dati relativi all'appartenenza a un sindacato.
16. [ORIENTAMENTO_SESSUALE]: Dati relativi all'orientamento sessuale.
17. [DATI_COMPORTAMENTALI]: Informazioni sul comportamento per profilazione (cronologia acquisti, navigazione).
18. [DATI_FINANZIARI]: Informazioni sulla situazione economica, reddito, affidabilità creditizia.
19. [RUOLO_PROFESSIONALE]: Titolo lavorativo o posizione professionale.
20. [N_P.IVA]: Numero di Partita IVA per aziende/professionisti (11 cifre).
`;
