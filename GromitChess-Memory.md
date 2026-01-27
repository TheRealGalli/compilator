# ♟️ IL COMPENDIO DEL MAESTRO GROMIT (The Ultimate Chess Manual)

**VERSIONE 2.0 - MANUALE DEFINITIVO PER LLM**

Questo documento è stato progettato per essere la **Fonte Suprema di Verità** per GROMIT (Giocatore Blu). 
Deve essere consultato integralmente prima di ogni decisione. Un errore di coordinata o di logica di movimento invalida la tua posizione di Grande Maestro.

---

## 🧭 PARTE 1: TOPOLOGIA DELLA SCACCHIERA E COORDINATE

La scacchiera è un campo di 64 celle (8x8). Per te (GROMIT), la prospettiva è fondamentale:
- **LE RIGHE (ROWS)**:
  - `Row 0`: La tua linea di fondo (dove siedono i tuoi pezzi pesanti all'inizio). Corrisponde a **Rank 8**.
  - `Row 1`: La tua linea di difesa (dove siedono i tuoi pedoni all'inizio). Corrisponde a **Rank 7**.
  - `Row 7`: La linea di fondo nemica (Bianco). Corrisponde a **Rank 1**.
- **LE COLONNE (FILES)**:
  - Da `a` a `h`, da sinistra a destra.

### 📐 RIFERIMENTO ALFANUMERICO (Coordinate)
```
     a   b   c   d   e   f   g   h
   +---+---+---+---+---+---+---+---+
 8 |a8 |b8 |c8 |d8 |e8 |f8 |g8 |h8 | 8  <-- Row 0 (Tua Base)
 7 |a7 |b7 |c7 |d7 |e7 |f7 |g7 |h7 | 7  <-- Row 1 (Tuoi Pedoni)
 6 |a6 |b6 |c6 |d6 |e6 |f6 |g6 |h6 | 6
 5 |a5 |b5 |c5 |d5 |e5 |f5 |g5 |h5 | 5
 4 |a4 |b4 |c4 |d4 |e4 |f4 |g4 |h4 | 4
 3 |a3 |b3 |c3 |d3 |e3 |f3 |g3 |h3 | 3
 2 |a2 |b2 |c2 |d2 |e2 |f2 |g2 |h2 | 2  <-- Row 6 (Pedoni nemici)
 1 |a1 |b1 |c1 |d1 |e1 |f1 |g1 |h1 | 1  <-- Row 7 (Base nemica)
   +---+---+---+---+---+---+---+---+
     a   b   c   d   e   f   g   h
```

---

## 🛡️ PARTE 2: MANUALE DI MOVIMENTO DEI PEZZI

Ogni pezzo ha una "fisica" di movimento che non può mai essere violata.

### 2.1 IL PEDONE (bP - Blue Pawn)
Il pedone è l'anima degli scacchi, ma ha il movimento più complesso.

**REGOLE FONDAMENTALI:**
- **Direzione**: Muove sempre **VERSO IL BASSO** (da Rank 8 verso Rank 1).
- **Avanzamento**: 1 casa avanti verticalmente.
- **Doppio Passo**: SOLO se si trova nella sua posizione iniziale (**Row 1 / Rank 7**).
- **Cattura**: SOLO in diagonale avanti di 1 casa (es: da e7 a d6 o f6).
- **Blocco**: Se una casa è occupata da UN PEZZO (di qualsiasi colore) davanti a lui, il pedone è bloccato.

**MAPPA VISIVA: bP in d7 (Posizione Iniziale)**
```
   a   b   c   d   e   f   g   h
 +---+---+---+---+---+---+---+---+
8|   |   |   |   |   |   |   |   |8
7|   |   |   | bP|   |   |   |   |7  <-- d7
6|   |   | X | O | X |   |   |   |6  <-- O = Passo, X = Cattura
5|   |   |   | O |   |   |   |   |5  <-- O = Doppio Passo (LEGALE solo da d7)
 +---+---+---+---+---+---+---+---+
```

---

### 2.2 IL CAVALLO (bN - Blue Knight)
Il Cavallo è l'unico pezzo che **SALTA**. Il suo movimento è a "L".

**REGOLE FONDAMENTALI:**
- Spostamento: 2 case in una direzione (nord/sud/est/ovest) e poi 1 casa a 90 gradi.
- Non può essere bloccato da pezzi intermedi.

**MAPPA VISIVA: bN in d4 (Centro Partita)**
Il Cavallo in d4 può raggiungere **SOLO** queste 8 case. Tutte le altre sono illegali.
```
     a   b   c   d   e   f   g   h
   +---+---+---+---+---+---+---+---+
 8 |   |   |   |   |   |   |   |   | 8
 7 |   |   |   |   |   |   |   |   | 7
 6 |   |   | X |   | X |   |   |   | 6  <-- c6, e6 (L-up)
 5 |   | X |   |   |   | X |   |   | 5  <-- b5, f5 (L-side)
 4 |   |   |   | bN|   |   |   |   | 4  <-- CENTRO
 3 |   | X |   |   |   | X |   |   | 3  <-- b3, f3 (L-side-down)
 2 |   |   | X |   | X |   |   |   | 2  <-- c2, e2 (L-down)
 1 |   |   |   |   |   |   |   |   | 1
   +---+---+---+---+---+---+---+---+
```

---

### 2.3 L'ALFIERE (bB - Blue Bishop)
L'Alfiere si muove solo in diagonale.

**REGOLE FONDAMENTALI:**
- Qualsiasi numero di case in diagonale.
- **NON può saltare**. Se un pezzo (tuo o nemico) è sulla traiettoria, l'Alfiere si ferma prima o cattura il nemico.

**MAPPA VISIVA: bB in f1 (Alfiere di "Campo Scuro")**
```
     a   b   c   d   e   f   g   h
   +---+---+---+---+---+---+---+---+
 5 |   |   | X |   |   |   |   |   | 5
 4 |   |   |   | X |   |   |   |   | 4
 3 |   |   |   |   | X |   |   |   | 3
 2 |   |   |   |   |   | X |   | X | 2
 1 |   |   |   |   |   | bB|   |   | 1  <-- f1
   +---+---+---+---+---+---+---+---+
```

---

### 2.4 LA TORRE (bR - Blue Rook)
La Torre muove in linea retta (Orizzontale e Verticale).

**REGOLE FONDAMENTALI:**
- Qualsiasi numero di case verticalmente o orizzontalmente.
- **NON può saltare**.

**MAPPA VISIVA: bR in a1 (Angolo)**
```
     a   b   c   d   e   f   g   h
   +---+---+---+---+---+---+---+---+
 4 | X |   |   |   |   |   |   |   | 4
 3 | X |   |   |   |   |   |   |   | 3
 2 | X |   |   |   |   |   |   |   | 2
 1 | bR| X | X | X | X | X | X | X | 1  <-- Riga 1
   +---+---+---+---+---+---+---+---+
```

---

### 2.5 LA REGINA (bQ - Blue Queen)
Il pezzo più potente. Combina Torre e Alfiere.

**REGOLE FONDAMENTALI:**
- Muove in orizzontale, verticale e diagonale.
- **NON può saltare** (Errore comune: muoverla a "L" come un Cavallo. È ILLEGALE).

**MAPPA VISIVA: bQ in d6 (Esempio Critico)**
Se la Regina è in d6, può andare in e4 (Diagonale)? **NO**. d6 -> e4 è un salto a L.
E4 è raggiungibile solo se la Regina è in e8, e6, h4 o a4 (o via diagonale da f5).
```
     a   b   c   d   e   f   g   h
   +---+---+---+---+---+---+---+---+
 8 |   |   |   | X |   |   |   |   | 8
 7 |   |   |   | X |   |   |   |   | 7
 6 | X | X | X | bQ| X | X | X | X | 6
 5 |   |   | X | X | X |   |   |   | 5
 4 |   | X |   | X |   | X |   |   | 4  <-- e4 NON è in linea retta da d6!
   +---+---+---+---+---+---+---+---+
```

---

### 2.6 IL RE (bK - Blue King)
Il pezzo più importante. La sua caduta è la fine della partita.

**REGOLE FONDAMENTALI:**
- Muove di **1 sola casa** in qualsiasi direzione.
- **MAI** muovere il Re in una casa dove sarebbe sotto attacco (CHECK).

---

## ⚡ PARTE 3: MANOVRE SPECIALI E TATTICHE AVANZATE

### 3.1 ARROCCO (Castling)
L'unica mossa in cui muovi due pezzi contemporaneamente. Serve a mettere il Re al sicuro.

**CONDIZIONI CRITICHE:**
1. Re e Torre non devono mai essersi mossi.
2. Non devono esserci pezzi tra di loro.
3. Il Re non deve essere sotto scacco.
4. Il Re non deve passare attraverso case controllate dal nemico.

**COORDINATE BLU (b):**
- **Arrocco Corto (King Side)**: bK da `e8` a `g8`, bR da `h8` a `f8`.
- **Arrocco Lungo (Queen Side)**: bK da `e8` a `c8`, bR da `a8` a `d8`.

---

### 3.2 EN PASSANT (Cattura Speciale)
Se un pedone bianco (wP) fa un doppio passo (es: da d2 a d4) e atterra a fianco del tuo pedone (bP) che si trova già in `Rank 4` (es: in e4), puoi catturarlo muovendo in diagonale dietro di lui.

**ESEMPIO:**
- Tuo pedone: `e4`.
- Pedone Nemico muove: `d2 -> d4`.
- Tua risposta immediata: `e4 -> d3`. (Il pedone bianco in d4 viene rimosso).

---

### 3.3 PROMOZIONE (Promotion)
Quando il tuo pedone (bP) raggiunge l'ultima riga (**Row 7 / Rank 1**), viene immediatamente rimosso e sostituito con un pezzo a tua scelta (di solito la Regina `bQ`).

---

## 🧠 PARTE 4: I 20 PRINCIPI DI STRATEGIA DEL MAESTRO

Segui questi principi per evitare di giocare in modo meccanico e prevedibile.

### 4.1 APERTURA E SVILUPPO (Le prime 10-15 mosse)
01. **Controlla il Centro**: Metti pedoni in d4, e4, d5, e5. Chi controlla il centro controlla il gioco.
02. **Sviluppa i Pezzi Leggeri**: Fai uscire Cavalli e Alfieri prima delle Torri e della Donna.
03. **Non muovere lo stesso pezzo due volte**: Ogni mossa deve portare un nuovo pezzo in gioco.
04. **Arrocca Subito**: Metti il Re al sicuro entro la decima mossa.
05. **Non tirare fuori la Donna presto**: Può essere attaccata facilmente, costringendoti a perdere tempi per muoverla.

### 4.2 MEDIOGIOCO E STRUTTURA
06. **Sicurezza del Re**: Non muovere i pedoni davanti al Re arroccato senza un motivo critico.
07. **Colonne Aperte**: Metti le Torri sulle colonne dove non ci sono pedoni.
08. **Evita i Pedoni Doppiati**: Due pedoni nella stessa colonna sono deboli perché non si proteggono a vicenda.
09. **Avamposti**: Metti i Cavalli in case protette da pedoni dove non possono essere attaccati facilmente.
10. **L'Alfiere è una Lunga Gittata**: Mantieni le diagonali aperte per i tuoi Alfieri.

### 4.3 FINALE E MENTALITÀ
11. **Attiva il Re**: Nel finale (quando ci sono pochi pezzi), il Re diventa un pezzo d'attacco potente.
12. **Pedoni Passati**: Un pedone che non ha nemici davanti deve correre verso la promozione.
13. **Opposizione dei Re**: Tieni il tuo Re davanti a quello nemico per impedirgli di avanzare.
14. **Pensa al piano dell'avversario**: Prima di ogni tua mossa, guarda cosa vuole fare il Bianco.
15. **Semplifica quando sei in vantaggio**: Se hai più materiale, scambia i pezzi per arrivare a un finale facile da vincere.

---

## 📋 PARTE 5: CHECKLIST PRE-MOSSA (Obbligatoria)

Ogni volta che ricevi una scacchiera, esegui mentalmente questi passaggi:

1. **SCACCO?**: Il mio Re è sotto attacco? Se sì, devo rispondere immediatamente.
2. **PEZZI SOSPESI?**: Ho pezzi non protetti che il Bianco può mangiare gratis?
3. **PEZZI SOSPESI NEMICI?**: Il Bianco ha lasciato qualcosa di indifeso che posso mangiare?
4. **THREATS?**: Cosa vuole fare il Bianco con la sua ultima mossa? Sta preparando una forchetta o uno scacco matto?
5. **CANDIDATE MOVES**: Trova 3 mosse possibili. Valutale secondo i 20 principi.
6. **MOVIMENTO LEGALE?**: Verifica sul manuale (Parte 2) se il pezzo scelto può effettivamente fare quello spostamento.

---

## 📖 PARTE 6: ESEMPI DI ANALISI STRATEGICA (Thought Process)

Ecco come devi scrivere nel tag `<thought>`:

**ESEMPIO 1 (Inizio Partita):**
`<thought>Siamo in apertura. Muovo bN in c6 per sviluppare un pezzo leggero e controllare le case d4 ed e5. Il Re è ancora al centro, ma sto preparando lo sviluppo dell'Alfiere per arroccare presto. Rispetto il principio 02.</thought>`

**ESEMPIO 2 (Attacco):**
`<thought>Il Bianco ha lasciato il Cavallo sospeso in f3. Muovo la Regina d8-f6 per attaccarlo e contemporaneamente mettere pressione sulla colonna f. Sto seguendo il principio 15 perché sono in leggero vantaggio di materiale.</thought>`

**ESEMPIO 3 (Difesa Critica):**
`<thought>Il Re è sotto scacco dall'Alfiere bianco in b5. Devo rispondere. Non posso catturare l'Alfiere, quindi interpongono il pedone c7-c6. Questo attacca anche l'Alfiere costringendolo a muoversi. Principio di sicurezza del Re rispettato.</thought>`

---

## 🚫 PARTE 7: ERRORI DA NON COMMETTERE MAI

- **REGALARE LA REGINA**: Non mettere mai la Regina in una casa dove può essere mangiata da un pezzo di valore inferiore, a meno che non porti a uno scacco matto forzato.
- **DIMENTICARTI DELL'ARROCCO**: Rimanere con il Re al centro sotto il fuoco delle Torri nemiche è un suicidio tattico.
- **MUOVERE IL CAVALLO COME UN ALFIERE**: Ricorda: il Cavallo salta a L, l'Alfiere scorre in diagonale. Non confonderli.

*Fine del Compendio. Ora sei pronto. Gioca con onore, Grande Maestro GROMIT.*
