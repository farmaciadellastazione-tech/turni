# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Italian-language static web app for **Farmacia della Stazione** (La Spezia): a digital board ("bacheca") of the **farmacie di turno** (on-duty pharmacies) of the Comune della Spezia. Designed to run full-screen on a touch kiosk in the pharmacy and to be updated remotely (also from a phone). No backend. Hosted on GitHub Pages: <https://farmaciadellastazione-tech.github.io/turni/>. All UI text and code comments are Italian and must stay Italian.

## Branches and deploy

- Work always on **`dev`**, never directly on production.
- **`main` is the production branch** — GitHub Pages serves it. Merge `dev → main` **only with explicit confirmation** (`git merge --no-ff dev`). A push is live within ~1 minute.
- `git push origin dev` after every significant change.

## Files

- `index.html` — **bacheca pubblica** (read-only). Shows the pharmacy on duty now, upcoming turni, clock, map, services, contacts. Auto-refreshes. Reads data over HTTP, so it must be served (not opened as `file://`).
- `edit-turni.html` — **editor** (mobile-friendly). Day-by-day calendar to edit turno, conturno (the `c` field), end time, extraordinary openings, notes. Writes to a GitHub Gist via the GitHub API (needs a PAT with `gist` scope, pasted into the field, kept in `localStorage`). Also imports PDFs (see below).
- `turni-parser.js` — **shared parser** (UMD: `require` in Node, `<script src>` in the browser). Exposes `parseAnnualText(text, anno)`, `parseBulletin(text)`, `parseSabatoPomeriggio(text)`, and `CANON`. Used by both the editor and the CLI generator. `parseSabatoPomeriggio` legge il documento "FARMACIE APERTE SABATO POMERIGGIO" dell'Ordine (Word/PDF, fonte separata dal bollettino settimanale): estrae data + orario + elenco nomi, raccogliendo **solo** il blocco iniziale di farmacie e fermandosi alle parole-indirizzo (VIA/CORSO/P.ZZA/…), così parole-via come "MIGLIARINA" non finiscono tra le aperte. Qui "Di Marola" e "Maimone" sono due farmacie distinte. Tollera token storpiati dentro il blocco nomi (recupero **fuzzy** via Levenshtein ≤2, segnalato in `problemi`): serve all'import del `.doc` binario, dove Word salva certi run con byte di servizio in mezzo al nome (es. `DELL'ARSENALE` → `DEL\x12ARSENALE`). Fixture: `data/esempio-sabato-*.txt`.
- `data/turni-<anno>.json` — calendar base, one record per day (`{t, c?}`), generated from the official PDF. The pages load *previous / current / next* year.
- `data/farmacie.json` — anagrafica: `{ indirizzo, telefono, zona? }` per pharmacy, keyed by the display name used in the turni data.
- `data/sorgente-turni-<anno>.txt` — text of the official annual PDF (historical source).
- `data/esempio-bollettino-*.txt` — real weekly bulletin fixtures (extracted from PDFs) used by the tests.
- `tools/genera-turni.mjs` — CLI generator/validator: official annual PDF → `data/turni-<anno>.json` (uses `pdf-parse`). See `tools/README.md`.

## Data model

```
data/turni-<anno>.json (base)  +  overrides (Gist)  =  turno mostrato
```

- **Base**: versioned `data/turni-<anno>.json`. Can be overridden remotely by a `turni-base.json` file on the Gist (if present, it wins) — that is how the editor's annual import publishes a new year without touching the repo.
- **Overrides/eccezioni**: a public **GitHub Gist** (ID `8f699fa0fd4566b2bbb2805b76ad482e`), file `turni-overrides.json` (`{ "overrides": { "YYYY-MM-DD": { t, c?, fineOra?, straord?, nota? } } }`). Only days that differ from the base are stored.
- **Altri file sullo stesso Gist** (letti dalla bacheca via URL raw, scritti dall'editor via API):
  - `farmacie-pos.json` — coordinate per la mappa.
  - `contenuti.json` — `{ servizi[], annunci[], ticker{scorre,velocita}, pubblicita{intervalloSec,durataSec,slide[]} }`. La chiave `pubblicita` alimenta lo **spot a tutto schermo** sul totem (overlay che compare ogni `intervalloSec` per `durataSec`, slide immagine o testo; solo sul kiosk, vedi `pianificaSpot`/`isMobile` in `index.html`). Le immagini sono data URL ridimensionati (lato max 1920, JPEG q0.8) caricati dal pannello "📺 Pubblicità" dell'editor.
  - `sabato.json` — `{ "YYYY-MM-DD": { orario, farmacie:[...] } }`. Le **farmacie aperte il sabato pomeriggio** (orario continuato). La bacheca, il sabato dalle 13:00 alle 20:00, sostituisce la sezione "Prossimi turni" con questo elenco (ordinato per vicinanza), vedi `sabatoPomeriggioOggi`/`renderNext`. Si popola dall'editor col pulsante **"🗓 Importa sabato pomeriggio (PDF)"** — stesso flusso dell'import bollettino: `estraiTestoPDF` → `parseSabatoPomeriggio` → `confirm()` di anteprima → salvataggio diretto su `sabato.json` (a differenza del bollettino che va negli override e si pubblica con 💾 Salva); scarta da solo i sabati passati. **Fonte**: i file `SABATO POMERIGGIO <data>.doc` nella cartella Drive `turni` del titolare — l'import accetta **sia il `.doc` Word sia il PDF**: il PDF passa da pdf.js (`estraiTestoPDF`), il `.doc` binario si legge grezzo come **windows-1252** (`estraiTestoSabato`; il testo è memorizzato single-byte con `\r` tra i paragrafi, il parser salta l'header binario e i nomi storpiati li recupera il fuzzy). Non serve più convertirlo in PDF a mano.

## Run / build / test

No bundler. Serve the folder over a static HTTP server (the bacheca's relative `fetch` of `data/*.json` fails on `file://`). Tests use **vitest** on the pure logic in `turni-parser.js`:

```bash
npm install        # once
npm test           # vitest: parser annuale + bollettini contro fixture reali
```

After any non-trivial edit, also **manually verify in a browser**: open the bacheca, confirm the on-duty pharmacy + its address/phone render and the upcoming list is correct; in the editor, import a bulletin and the annual PDF and confirm the recognized-day counts.

## Architecture / gotchas

- **Turno logic**: a day's turno runs from **08:30 to 08:30** of the next day (end time customizable per day). So before 08:30 the "current" pharmacy is still yesterday's (`getTurnoAttivo`).
- **PDF text extraction (critical)**: the editor's `estraiTestoPDF` (pdf.js) must assemble text **like `pdf-parse`** — concatenate `item.str` and break on `item.hasEOL`, with **no space between items**. Joining items with `' '` splits words and numbers (the year `2026` became `20 2 6`, breaking the annual table import). Don't reintroduce a space join.
- **Pharmacy names / renames** live in `CANON` (`turni-parser.js`). The official PDF has OCR typos (`ALLENAZA`, `ARGENITERI`) and bulletins use historical names; all map to one canonical display name. **Renames**: both the old and new spelling map to the new name (e.g. Pegazzano `CAMPODONICO` and `DEL FICO` → `Del Fico`; `BEDINI`/`FELIA PRIONE` → `Felia Prione`). Old names survive only as parsing aliases, never as displayed/anagrafica names.
- **Composite turni** (e.g. `Di Marola/Maimone`) are two physical pharmacies sharing a 24h turno: split the display name on `/` for per-pharmacy lookups in `data/farmacie.json`.
- **Annual import is browser-only-fragile-then-fixed**: the in-editor annual import works via the pdf-parse-style extraction above; the CLI `tools/genera-turni.mjs` is the reference path for (re)generating a year's base.
- **Kiosk vs mobile**: the bacheca runs on a **Windows mini-PC touch kiosk without telephony**. A `tel:` link there does nothing useful (and can pop a system dialog), so phone numbers are a `tel:` link **only on mobile** (`navigator.userAgentData`/UA), plain text otherwise. Avoid kiosk-hostile interactions (`tel:`/`mailto:`/downloads/new windows) on the public board.
- **Pharmacy identity hardcoded** in the bacheca header/footer: `Farmacia della Stazione · Via Fiume 75`. Same across all our farmacia projects — if branding changes, grep across `C:\Progetti\` rather than guessing a config location.
- **No framework** — vanilla JS, plain DOM. Don't introduce React/Vue/build steps; the deployment story is "git push, GH Pages serves".
- **Comments in Italian** in the code (author preference).

## Token GitHub lato client

The editor keeps the Gist PAT in `localStorage`. Since the site shares an origin with other org Pages projects, this is a known weak point (roadmap → serverless proxy, e.g. Cloudflare). Use a minimal-scope, short-lived token meanwhile.

## Testing rules
- Never modify existing tests to make them pass (fix the implementation)
- Never update snapshots without explicit instruction
- Use transactions for database tests (roll back after each test)
- Mark flaky tests with @pytest.mark.flaky
- Write the failing test before fixing any reported bug
- Run the full suite before declaring work complete

## Linguaggio della comunicazione

L'autore è italiano: risposte e commenti nei file in italiano salvo richiesta diversa.
