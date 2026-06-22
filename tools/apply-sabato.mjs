// apply-sabato.mjs — Applica un .doc "SABATO POMERIGGIO" al file sabato.json del Gist.
//
// Uso: node tools/apply-sabato.mjs <sabato.doc>
//
// Env:
//   GIST_PAT — token GitHub con scope "gist" (obbligatorio)
//
// Legge il .doc come windows-1252 (stesso metodo dell'editor: estraiTestoSabato),
// chiama parseSabatoPomeriggio(), scarta i sabati passati, merge con sabato.json.
//
// Exit: 0 = ok · 1 = errore

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { parseSabatoPomeriggio } = require(resolve(dirname(fileURLToPath(import.meta.url)), '..', 'turni-parser.js'));

const GIST_ID = '8f699fa0fd4566b2bbb2805b76ad482e';
const GIST_FILE = 'sabato.json';
const GIST_OWNER = 'farmaciadellastazione-tech';
const GIST_RAW = `https://gist.githubusercontent.com/${GIST_OWNER}/${GIST_ID}/raw/${GIST_FILE}`;
const GIST_API = `https://api.github.com/gists/${GIST_ID}`;

const docPath = process.argv[2];
if (!docPath) {
  console.error('Uso: node tools/apply-sabato.mjs <sabato.doc>');
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

const buf = readFileSync(docPath);
const testo = estraiTestoDoc(buf);

const { data, orario, farmacie, problemi } = parseSabatoPomeriggio(testo);

if (problemi.length) {
  console.warn('Problemi di parsing:');
  problemi.forEach(p => console.warn('  ' + p));
}

if (!data) {
  console.error('Data non riconosciuta nel documento — uscita.');
  process.exit(1);
}

if (!farmacie.length) {
  console.error('Nessuna farmacia riconosciuta nel documento — uscita.');
  process.exit(1);
}

// Scarta sabati passati
const oggi = new Date().toISOString().slice(0, 10);
if (data < oggi) {
  console.log(`Sabato ${data} è già passato — niente da fare.`);
  process.exit(0);
}

console.log(`Sabato ${data} — orario ${orario} — ${farmacie.length} farmacie: ${farmacie.join(', ')}`);

// Leggi sabato.json attuale dal Gist
let current = {};
try {
  const r = await fetch(`${GIST_RAW}?t=${Date.now()}`);
  if (r.ok) current = await r.json();
} catch (e) {
  console.warn('sabato.json non leggibile:', e.message);
}

// Controlla se è già aggiornato
const ex = current[data];
const neo = { orario, farmacie };
if (ex && JSON.stringify(ex) === JSON.stringify(neo)) {
  console.log('Nessuna modifica — Gist invariato.');
  process.exit(0);
}

// Rimuovi sabati passati e aggiorna il sabato corrente
const merged = {};
for (const [k, v] of Object.entries(current)) {
  if (k >= oggi) merged[k] = v;
}
merged[data] = neo;

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

console.log(`✓ sabato.json aggiornato per il ${data}.`);
