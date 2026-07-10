// apply-sabato.mjs — Applica uno o più .doc "SABATO POMERIGGIO" a sabato.json del Gist.
//
// Uso: node tools/apply-sabato.mjs <sabato.doc> [altro.doc …]
//      (la mail dei turni porta un doc per sabato: si passano tutti insieme,
//       così il Gist viene aggiornato con un solo PATCH)
//
// Env:
//   GIST_PAT — token GitHub con scope "gist" (obbligatorio)
//
// Legge i .doc come windows-1252 (stesso metodo dell'editor: estraiTestoSabato),
// chiama parseSabatoPomeriggio(), scarta i sabati passati, merge con sabato.json.
//
// Exit: 0 = ok · 1 = errore (anche se solo uno dei doc non è leggibile)

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { sembraDocx, sembraPdf } from './selezione-mail.mjs';

const require = createRequire(import.meta.url);
const { parseSabatoPomeriggio } = require(resolve(dirname(fileURLToPath(import.meta.url)), '..', 'turni-parser.js'));

const GIST_ID = '8f699fa0fd4566b2bbb2805b76ad482e';
const GIST_FILE = 'sabato.json';
const GIST_OWNER = 'farmaciadellastazione-tech';
const GIST_RAW = `https://gist.githubusercontent.com/${GIST_OWNER}/${GIST_ID}/raw/${GIST_FILE}`;
const GIST_API = `https://api.github.com/gists/${GIST_ID}`;

const docPaths = process.argv.slice(2);
if (!docPaths.length) {
  console.error('Uso: node tools/apply-sabato.mjs <sabato.doc> [altro.doc …]');
  process.exit(1);
}

const pat = process.env.GIST_PAT;
if (!pat) {
  console.error('Manca GIST_PAT.');
  process.exit(1);
}

// Legge il .doc binario come windows-1252 e ne estrae il testo (stesso metodo
// dell'editor: salta l'header binario, usa \r come separatore di paragrafo).
function estraiTestoDoc(buf) {
  const testo = buf.toString('latin1');
  // Cerca il primo paragrafo che sembra testo leggibile (lettere ASCII)
  const righe = testo.split('\r').map(r => r.replace(/[^\x20-\x7E\xC0-\xFF]/g, ' ').trim()).filter(Boolean);
  return righe.join('\n');
}

// Parsa tutti i doc; un doc illeggibile non blocca gli altri ma segna l'errore.
const oggi = new Date().toISOString().slice(0, 10);
const nuovi = {};   // data → { orario, farmacie }
let errori = 0;

for (const docPath of docPaths) {
  const buf = readFileSync(docPath);

  if (sembraDocx(buf)) {
    console.error(`${docPath}: è un .docx (Word moderno), non leggibile come windows-1252 — convertirlo in .doc o importarlo dall'editor. Saltato.`);
    errori++;
    continue;
  }

  // L'elenco può arrivare anche in PDF (come nell'import manuale dall'editor):
  // si riconosce dal contenuto e si estrae il testo con pdf-parse.
  let testo;
  if (sembraPdf(buf)) {
    try {
      const { PDFParse } = require('pdf-parse');
      const parser = new PDFParse({ data: buf });
      ({ text: testo } = await parser.getText());
    } catch (e) {
      console.error(`${docPath}: PDF non leggibile (${e.message}) — saltato.`);
      errori++;
      continue;
    }
  } else {
    testo = estraiTestoDoc(buf);
  }

  const { data, orario, farmacie, problemi } = parseSabatoPomeriggio(testo);

  if (problemi.length) {
    console.warn(`Problemi di parsing in ${docPath}:`);
    problemi.forEach(p => console.warn('  ' + p));
  }

  if (!data) {
    console.error(`${docPath}: data non riconosciuta — saltato.`);
    errori++;
    continue;
  }

  if (!farmacie.length) {
    console.error(`${docPath}: nessuna farmacia riconosciuta — saltato.`);
    errori++;
    continue;
  }

  // Scarta sabati passati
  if (data < oggi) {
    console.log(`${docPath}: sabato ${data} è già passato — saltato.`);
    continue;
  }

  console.log(`${docPath}: sabato ${data} — orario ${orario} — ${farmacie.length} farmacie: ${farmacie.join(', ')}`);
  nuovi[data] = { orario, farmacie };
}

if (!Object.keys(nuovi).length) {
  console.log('Nessun sabato futuro da applicare.');
  process.exit(errori ? 1 : 0);
}

// Leggi sabato.json attuale dal Gist
let current = {};
try {
  const r = await fetch(`${GIST_RAW}?t=${Date.now()}`);
  if (r.ok) current = await r.json();
} catch (e) {
  console.warn('sabato.json non leggibile:', e.message);
}

// Rimuovi sabati passati e applica i nuovi
const merged = {};
for (const [k, v] of Object.entries(current)) {
  if (k >= oggi) merged[k] = v;
}
Object.assign(merged, nuovi);

if (JSON.stringify(merged) === JSON.stringify(current)) {
  console.log('Nessuna modifica — Gist invariato.');
  process.exit(errori ? 1 : 0);
}

const nuovoContenuto = JSON.stringify(merged, null, 2);
const resp = await fetch(GIST_API, {
  method: 'PATCH',
  headers: {
    Authorization: `Bearer ${pat}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ files: { [GIST_FILE]: { content: nuovoContenuto } } }),
});

if (!resp.ok) {
  const err = await resp.text();
  console.error(`Errore API Gist (${resp.status}): ${err}`);
  process.exit(1);
}

console.log(`✓ sabato.json aggiornato per: ${Object.keys(nuovi).join(', ')}.`);
if (errori) console.error(`ATTENZIONE: aggiornamento riuscito ma ${errori} doc non applicat${errori === 1 ? 'o' : 'i'} (vedi sopra) — run segnato in errore per farlo notare.`);
process.exit(errori ? 1 : 0);
