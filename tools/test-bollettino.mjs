// Test del parser dei bollettini settimanali (TurniParser.parseBulletin).
// Usa un bollettino reale dell'Ordine (giugno 2022) come fixture.
//   node tools/test-bollettino.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const TurniParser = require(join(__dirname, '..', 'turni-parser.js')); // UMD: module.exports in Node

const CASI = [
  {
    file: 'esempio-bollettino-2022-06.txt',
    atteso: {
      '2022-06-03': { t: 'Beretta' },
      '2022-06-04': { t: 'Maglio' },
      '2022-06-05': { t: 'Internazionale', c: 'Argentieri' },
      '2022-06-06': { t: 'Di Marola/Maimone' },
      '2022-06-07': { t: 'Felia Prione' },
      '2022-06-08': { t: 'Farmaceutica' },
      '2022-06-09': { t: "Dell'Aquila" },
      '2022-06-10': { t: 'Centrale' },
    },
  },
  {
    file: 'esempio-bollettino-2022-05.txt',
    atteso: {
      '2022-05-20': { t: 'S.ta Barbara' },
      '2022-05-21': { t: 'Centrale' },
      '2022-05-22': { t: 'Maglio', c: 'Tarantola' },
      '2022-05-23': { t: 'Bonaschi' },
      '2022-05-24': { t: 'Migliarina' },
      '2022-05-25': { t: 'Baracchini' },
      '2022-05-26': { t: 'Alleanza' },
      '2022-05-27': { t: 'Degli Speziali' },
    },
  },
  {
    // Formato 2026 (estratto reale dal PDF dell'Ordine): nuova farmacia "Del Fico"
    // in intestazione, "DI MAROLA" al posto di "Bastiani", "Felia Prione (Bedini)".
    file: 'esempio-bollettino-2026-05.txt',
    atteso: {
      '2026-05-29': { t: 'Farina' },
      '2026-05-30': { t: 'Argentieri' },
      '2026-05-31': { t: 'Migliarina', c: 'Croce Verde' },
      '2026-06-01': { t: 'Di Marola/Maimone' },
      '2026-06-02': { t: 'Del Porto', c: 'Della Stazione' },
      '2026-06-03': { t: 'Schiaffino' },
      '2026-06-04': { t: 'Bergero' },
      '2026-06-05': { t: 'Felia Prione' },
    },
  },
  {
    // Settimana in cui "Del Fico" (ex Campodonico, Pegazzano) è di turno.
    file: 'esempio-bollettino-2026-05b.txt',
    atteso: {
      '2026-05-22': { t: 'Beretta' },
      '2026-05-23': { t: 'Croce Rossa' },
      '2026-05-24': { t: 'S.ta Barbara', c: 'Croce Verde' },
      '2026-05-25': { t: 'Di Prima' },
      '2026-05-26': { t: "Dell'Arsenale" },
      '2026-05-27': { t: 'Del Fico' },
      '2026-05-28': { t: 'Centrale' },
      '2026-05-29': { t: 'Farina' },
    },
  },
  {
    file: 'esempio-bollettino-2026-06.txt',
    atteso: {
      '2026-06-05': { t: 'Felia Prione' },
      '2026-06-06': { t: "Dell'Aquila" },
      '2026-06-07': { t: 'Baracchini', c: 'Alleanza' },
      '2026-06-08': { t: 'Croce Rossa' },
      '2026-06-09': { t: 'Bonaschi' },
      '2026-06-10': { t: 'Beretta' },
      '2026-06-11': { t: 'Croce Bianca' },
      '2026-06-12': { t: 'Degli Speziali' },
    },
  },
];

let ok = 0, ko = 0;
for (const caso of CASI) {
  console.log(`\n# ${caso.file}`);
  const text = readFileSync(join(__dirname, '..', 'data', caso.file), 'utf8');
  const { turni, problemi } = TurniParser.parseBulletin(text);
  const chiavi = new Set([...Object.keys(caso.atteso), ...Object.keys(turni)]);
  for (const k of [...chiavi].sort()) {
    const a = JSON.stringify(caso.atteso[k] ?? null);
    const g = JSON.stringify(turni[k] ?? null);
    if (a === g) { ok++; console.log(`OK  ${k}  ${g}`); }
    else { ko++; console.log(`KO  ${k}  atteso=${a}  ottenuto=${g}`); }
  }
  if (problemi.length) console.log('Problemi:', problemi);
}
console.log(`\nRisultato: ${ok} ok, ${ko} ko`);
process.exit(ko ? 1 : 0);
