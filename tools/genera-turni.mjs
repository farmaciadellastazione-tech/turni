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

// Nomi canonici (identici a quelli usati dalle pagine) + alias per refusi/OCR del PDF.
const CANON = {
  'CROCE ROSSA': 'Croce Rossa', 'CROCE BIANCA': 'Croce Bianca', 'CROCE VERDE': 'Croce Verde',
  'DI MAROLA/MAIMONE': 'Di Marola/Maimone', 'ALLEANZA': 'Alleanza', 'BERETTA': 'Beretta',
  'ARGENTIERI': 'Argentieri', 'INTERNAZIONALE': 'Internazionale', 'BONASCHI': 'Bonaschi',
  "DELL'ARSENALE": "Dell'Arsenale", "DELL'AQUILA": "Dell'Aquila", 'DI PRIMA': 'Di Prima',
  'CAMPODONICO': 'Campodonico', 'S.TA BARBARA': 'S.ta Barbara', 'SCHIAFFINO': 'Schiaffino',
  'TARANTOLA': 'Tarantola', 'FELIA PRIONE': 'Felia Prione', 'DELLA MARINA': 'Della Marina',
  'DELLA STAZIONE': 'Della Stazione', 'BERGERO': 'Bergero', 'MIGLIARINA': 'Migliarina',
  'MAGLIO': 'Maglio', 'BARACCHINI': 'Baracchini', 'FARMACEUTICA': 'Farmaceutica',
  'FARINA': 'Farina', 'TAPPARO': 'Tapparo', 'CENTRALE': 'Centrale', 'DEL PORTO': 'Del Porto',
  'DEGLI SPEZIALI': 'Degli Speziali',
  // alias OCR / refusi noti
  'ALLENAZA': 'Alleanza', 'DI MAROLA/MAIOMONE': 'Di Marola/Maimone', 'ARGENITERI': 'Argentieri',
};

const WD = new Set(['LUNEDI', 'MARTEDI', 'MERCOLEDI', 'GIOVEDI', 'VENERDI', 'SABATO', 'DOMENICA']);
const MESI = ['GENNAIO', 'FEBBRAIO', 'MARZO', 'APRILE', 'MAGGIO', 'GIUGNO', 'LUGLIO', 'AGOSTO',
  'SETTEMBRE', 'OTTOBRE', 'NOVEMBRE', 'DICEMBRE'];
const WD_RE = new RegExp('(' + [...WD].join('|') + ')\\d+$');

const txt = (await readSource(srcPath)).replace(/\r\n?/g, '\n').replace(/’/g, "'");

// Corpo testuale di un mese: dall'intestazione del mese fino al mese successivo
// (per dicembre, fino a "GENNAIO <anno+1>" o fine file).
function bodyOf(mese, idx) {
  const start = txt.indexOf('\n' + mese + '\n');
  if (start === -1) throw new Error('Mese non trovato nel testo: ' + mese);
  let end;
  if (idx < 11) end = txt.indexOf('\n' + MESI[idx + 1] + '\n', start + 1);
  else end = txt.indexOf('GENNAIO ' + (ANNO + 1));
  return txt.slice(start + mese.length + 2, end === -1 ? undefined : end);
}

// Match goloso di un nome di farmacia a partire dai token i: prova 2 token, poi 1.
function matchName(tokens, i) {
  for (const len of [2, 1]) {
    const key = tokens.slice(i, i + len).join(' ');
    if (CANON[key]) return { name: CANON[key], used: len };
  }
  return null;
}

const parsed = {};
const problemi = [];

MESI.forEach((mese, idx) => {
  const body = bodyOf(mese, idx);
  // tokenizza; stacca eventuali footnote attaccati al giorno della settimana (es. MERCOLEDI3)
  const toks = body.split(/\s+/).map(t => t.replace(WD_RE, '$1')).filter(Boolean);
  const wIdx = [];
  toks.forEach((t, i) => { if (WD.has(t)) wIdx.push(i); });

  wIdx.forEach((w, k) => {
    const giorno = parseInt(toks[w - 1], 10);
    if (!giorno) return;
    // i token dei nomi vanno da dopo il weekday fino a prima del numero del giorno successivo
    const stop = (k + 1 < wIdx.length) ? wIdx[k + 1] - 1 : toks.length;
    const nameToks = toks.slice(w + 1, stop).filter(t => !/^[1-9]$/.test(t)); // togli marcatori footnote isolati

    const names = [];
    let i = 0;
    while (i < nameToks.length && names.length < 2) {
      const m = matchName(nameToks, i);
      if (!m) break;
      names.push(m.name);
      i += m.used;
    }
    if (!names.length) {
      problemi.push(`${ANNO}-${idx + 1}-${giorno}: nessun nome riconosciuto (token: ${nameToks.join('|')})`);
      return;
    }
    const key = `${ANNO}-${String(idx + 1).padStart(2, '0')}-${String(giorno).padStart(2, '0')}`;
    const rec = { t: names[0] };
    if (names[1]) rec.c = names[1];
    parsed[key] = rec;
  });
});

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
