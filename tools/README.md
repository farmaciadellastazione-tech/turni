# tools/ — generatore calendario turni

Strumento per costruire il calendario turni di un anno direttamente dal **PDF ufficiale**
dell'Ordine Provinciale Farmacisti di La Spezia ("CALENDARIO TURNI SP ANNO _anno_").

## Preparazione (una volta sola)

Per leggere i PDF serve installare la dipendenza locale:

```bash
cd tools
npm install
```

(crea `tools/node_modules/`, che non viene versionato.)

## Aggiornamento annuale (la procedura)

1. **Salva il PDF** del nuovo anno, ad esempio in `data/calendario-turni-2027.pdf`.
2. **Genera** il calendario passando direttamente il PDF:
   ```bash
   node tools/genera-turni.mjs data/calendario-turni-2027.pdf 2027
   ```
   Crea `data/turni-2027.json` (mappa `data → {t, c?}`), che le pagine caricano da sole.
3. (Consigliato) **Valida** rigenerando un anno già noto e confrontandolo, per verificare
   che il parser interpreti bene il PDF:
   ```bash
   node tools/genera-turni.mjs data/calendario-turni-2026.pdf 2026 --validate data/turni-2026.json
   ```
   Deve stampare `✓ Output identico al riferimento.`

In alternativa al PDF si può passare un file di testo già estratto (`.txt`): l'uso è identico.

**Se il calendario arriva in Word (`.doc`)** — come la bozza 2027 — convertilo prima in PDF
con LibreOffice e poi procedi come sopra:

```bash
"C:/Program Files/LibreOffice/program/soffice.exe" --headless --convert-to pdf "CALENDARIO TURNI ANNO 2027.doc"
```

**Versione provvisoria**: `turni-2027.json` è generato dalla **bozza** inviata da Federfarma
il 24/09/2026 (allegato 2 del prot. n. 2025). Quando arriva la versione definitiva basta
rigenerarlo dal nuovo file (e aggiornare `sorgente-turni-2027.txt`); le correzioni urgenti
ad anno in corso restano negli override del Gist.

**Avviso automatico**: il workflow giornaliero (`controlla-calendario-annuale.mjs`) si
accorge della mail Federfarma col calendario annuale (allegato "CALENDARIO TURNI … ANNO
<anno>", bozza o ufficiale) e manda una mail di avviso alla casella della farmacia; poi
mette alla mail di Federfarma l'etichetta Gmail **"Calendario turni annuale"** così non
avvisa due volte. L'import resta manuale (procedura sopra).

**Base sul Gist**: se sul Gist esiste `turni-base.json`, le pagine la **uniscono** alla base
del repo (`TurniParser.unisciBase`: vince il Gist giorno per giorno). Un anno nuovo
committato nel repo è quindi visibile anche se il Gist contiene solo l'anno precedente.
L'import annuale dell'editor scrive sul Gist solo l'anno importato (mai gli anni del repo).
Attenzione: se un anno è stato importato dall'editor, le correzioni successive di quell'anno
vanno fatte dall'editor — rigenerarlo nel repo non basterebbe, perché il Gist vince.

## Note

- I nomi delle farmacie vengono **normalizzati** sui nomi canonici (vedi `CANON`
  in `../turni-parser.js`, il parser condiviso usato anche dall'editor). Il PDF ufficiale
  contiene a volte refusi/errori OCR (es. `ALLENAZA`, `ARGENITERI`): se ne incontri di
  nuovi, aggiungi un alias in `CANON`. Lì sono gestiti anche i **rinominamenti** (es.
  Pegazzano: `CAMPODONICO` e `DEL FICO` puntano entrambi a `Del Fico`).
- Il campo `c` (conturno) è la farmacia di supporto a orario minimo nei **festivi**;
  viene letto dalla colonna CONTURNO del PDF.
- Se il parser non riconosce un nome, si ferma e segnala il giorno problematico
  invece di scrivere dati sbagliati.

## Bollettini settimanali

Oltre al calendario annuale, `../turni-parser.js` espone `parseBulletin()` per i
**bollettini settimanali** discorsivi dell'Ordine (*"… Diurno e notturno"*), usati
dall'import 📋 dell'editor.

I test (vitest) stanno in `../tests/turni-parser.test.js` e girano dalla root del repo:

```bash
npm install   # una volta
npm test      # parser annuale + bollettini contro fixture reali
```

Le fixture sono in `../data/esempio-bollettino-*.txt` (testo estratto da PDF 2022 e 2026).

## File

- `genera-turni.mjs` — il generatore/validatore del calendario annuale (legge PDF o testo)
- `../tests/turni-parser.test.js` — test vitest del parser (annuale + bollettini)
- `package.json` / `package-lock.json` — dipendenza `pdf-parse`
- `../turni-parser.js` — parser condiviso (`parseAnnualText`, `parseBulletin`, `CANON`)
- `../data/sorgente-turni-2026.txt` — testo del PDF 2026 (sorgente storica)
- `../data/turni-2026.json` — calendario 2026 generato e validato
- `../data/sorgente-turni-2027.txt` — testo della bozza 2027 (dal `.doc`, via PDF)
- `../data/turni-2027.json` — calendario 2027 **provvisorio** (bozza)
- `../data/farmacie.json` — anagrafica (indirizzo + telefono) di ogni farmacia

## Notifica degli aggiornamenti automatici

Il workflow giornaliero manda una mail di riepilogo alla casella della farmacia **solo**
quando cambia qualcosa (bollettino o sabato pomeriggio applicati: giorni, turni, conturni,
farmacie aperte) **o** quando un passo fallisce (con il link al giro). Nei giorni senza
novità nessuna mail. `apply-bollettino.mjs` / `apply-sabato.mjs` registrano le modifiche in
`.notifica-aggiornamento.json` (via `notifica.mjs`, testato), l'ultimo passo
`notifica-aggiornamento.mjs` compone e invia la mail con la stessa App Password Gmail.
