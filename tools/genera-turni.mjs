#!/usr/bin/env node
// Genera il calendario turni di un anno a partire dal PDF ufficiale
// "CALENDARIO TURNI SP ANNO <anno>" dell'Ordine Provinciale Farmacisti di La Spezia.
//
// Uso:
//   node tools/genera-turni.mjs <sorgente.pdf|.txt> <anno> [--validate <turni-AAAA.json>]
//
// - <sorgente>     : il PDF annuale (consigliato) oppure il testo già estratto (.txt)
// - <anno>         : anno da estrarre (es. 2026)
// - --validate F   : confronta l'output con un JSON di riferimento (es. data/turni-2026.json)
//                    e segnala le differenze, senza scrivere.
//
// Per leggere i PDF serve la dipendenza locale pdf-parse:
//   cd tools && npm install
//
// Senza --validate, scrive data/turni-<anno>.json (mappa data -> {t, c?}),
// nella stessa forma usata dalle pagine (index.html / edit-turni.html).

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { parseAnnualText } = require('../turni-parser.js');

const [, , srcPath, annoArg, ...rest] = process.argv;
if (!srcPath || !annoArg) {
  console.error('Uso: node tools/genera-turni.mjs <sorgente.pdf|.txt> <anno> [--validate <turni-AAAA.json>]');
  process.exit(1);
}
const ANNO = parseInt(annoArg, 10);
const validateIdx = rest.indexOf('--validate');
const validateFile = validateIdx !== -1 ? rest[validateIdx + 1] : null;

// Legge la sorgente: estrae il testo dal PDF, oppure legge direttamente un .txt.
async function readSource(path) {
  if (/\.pdf$/i.test(path)) {
    let PDFParse;
    try { ({ PDFParse } = require('pdf-parse')); }
    catch { console.error('Manca pdf-parse: esegui "cd tools && npm install".'); process.exit(1); }
    const parser = new PDFParse({ data: readFileSync(path) });
    const r = await parser.getText();
    return r.text || '';
  }
  return readFileSync(path, 'utf8');
}

const { turni: parsed, problemi } = parseAnnualText(await readSource(srcPath), ANNO);

const chiavi = Object.keys(parsed).sort();
console.log(`Anno ${ANNO}: ${chiavi.length} giorni estratti.`);
if (problemi.length) {
  console.log('\nPROBLEMI DI PARSING:');
  problemi.forEach(p => console.log('  ' + p));
}

// --- Validazione opzionale contro un JSON di riferimento ---
if (validateFile) {
  const REF = JSON.parse(readFileSync(validateFile, 'utf8'));
  const allKeys = [...new Set([...Object.keys(REF), ...chiavi])].sort();
  let ok = 0;
  const diffs = [];
  for (const kk of allKeys) {
    const b = REF[kk], p = parsed[kk];
    if (!b) { diffs.push(`+ ${kk}: parser=${JSON.stringify(p)} (manca nel riferimento)`); continue; }
    if (!p) { diffs.push(`- ${kk}: riferimento=${JSON.stringify(b)} (manca nel parser)`); continue; }
    if (b.t !== p.t || (b.c || null) !== (p.c || null)) {
      diffs.push(`~ ${kk}: riferimento=${JSON.stringify(b)}  parser=${JSON.stringify(p)}`);
    } else ok++;
  }
  console.log(`\nValidazione: ${ok} coincidenti, ${diffs.length} differenze.`);
  if (diffs.length) { diffs.forEach(d => console.log('  ' + d)); process.exit(1); }
  console.log('✓ Output identico al riferimento.');
  process.exit(0);
}

// --- Scrittura JSON ---
if (problemi.length) {
  console.error('\nGenerazione interrotta: risolvi prima i problemi di parsing.');
  process.exit(1);
}
const out = {};
for (const k of chiavi) out[k] = parsed[k];
mkdirSync('data', { recursive: true });
const outPath = `data/turni-${ANNO}.json`;
writeFileSync(outPath, JSON.stringify(out, null, 0).replace(/\},/g, '},\n') + '\n', 'utf8');
console.log(`\n✓ Scritto ${outPath}`);
