// apply-bollettino.mjs — Applica un bollettino PDF agli override del Gist.
//
// Uso: node tools/apply-bollettino.mjs <bollettino.pdf>
//
// Env:
//   GIST_PAT — token GitHub con scope "gist" (obbligatorio)
//
// Legge il PDF, chiama parseBulletin(), merge con gli override esistenti sul Gist
// (preserva fineOra/straord/nota manuali), aggiorna il Gist solo se qualcosa cambia.
//
// Exit: 0 = ok · 1 = errore

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { parseBulletin } = require(resolve(dirname(fileURLToPath(import.meta.url)), '..', 'turni-parser.js'));

const GIST_ID = '8f699fa0fd4566b2bbb2805b76ad482e';
const GIST_FILE = 'turni-overrides.json';
const GIST_OWNER = 'farmaciadellastazione-tech';
const GIST_RAW = `https://gist.githubusercontent.com/${GIST_OWNER}/${GIST_ID}/raw/${GIST_FILE}`;
const GIST_API = `https://api.github.com/gists/${GIST_ID}`;

const pdfPath = process.argv[2];
if (!pdfPath) {
  console.error('Uso: node tools/apply-bollettino.mjs <bollettino.pdf>');
  process.exit(1);
}

const pat = process.env.GIST_PAT;
if (!pat) {
  console.error('Manca GIST_PAT.');
  process.exit(1);
}

// 1. Estrai testo dal PDF (stesso metodo di genera-turni.mjs)
let PDFParse;
try { ({ PDFParse } = require('pdf-parse')); }
catch { console.error('Manca pdf-parse: esegui npm install nella cartella tools/.'); process.exit(1); }

const parser = new PDFParse({ data: readFileSync(pdfPath) });
const { text } = await parser.getText();

// 2. Parsa il bollettino
const { turni, problemi } = parseBulletin(text);
if (problemi.length) {
  console.warn('Problemi di parsing:');
  problemi.forEach(p => console.warn('  ' + p));
}
const giorni = Object.keys(turni);
if (!giorni.length) {
  console.log('Nessun turno estratto dal bollettino — niente da fare.');
  process.exit(0);
}
console.log(`Estratti ${giorni.length} giorni dal bollettino: ${giorni.join(', ')}`);

// 3. Leggi overrides attuali dal Gist (cache-busting con timestamp)
let current = { overrides: {} };
try {
  const r = await fetch(`${GIST_RAW}?t=${Date.now()}`);
  if (r.ok) {
    current = await r.json();
  } else {
    console.warn(`Gist non leggibile (${r.status}), parto da zero.`);
  }
} catch (e) {
  console.warn('Gist non raggiungibile:', e.message);
}
const existing = current.overrides || {};

// 4. Merge: aggiorna t/c ma preserva fineOra, straord, nota manuali
let changed = 0;
const merged = { ...existing };
for (const [data, rec] of Object.entries(turni)) {
  const ex = existing[data] || {};
  const neo = {
    ...ex,          // preserva fineOra, straord, nota, ecc.
    t: rec.t,
  };
  if (rec.c) {
    neo.c = rec.c;
  } else {
    delete neo.c;
  }
  if (JSON.stringify(ex) !== JSON.stringify(neo)) {
    merged[data] = neo;
    changed++;
    const prima = Object.keys(ex).length ? JSON.stringify(ex) : '(nuovo)';
    console.log(`  ${data}: ${prima} → ${JSON.stringify(neo)}`);
  }
}

if (!changed) {
  console.log('Nessuna modifica rispetto agli override esistenti — Gist invariato.');
  process.exit(0);
}

// 5. Aggiorna il Gist
const nuovoContenuto = JSON.stringify({ overrides: merged }, null, 2);
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

console.log(`✓ Gist aggiornato: ${changed} giorn${changed === 1 ? 'o modificato' : 'i modificati'}.`);
