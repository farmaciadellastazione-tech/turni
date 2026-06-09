import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

// turni-parser.js è UMD (module.exports in Node): lo carico via require, come fa
// l'editor via <script src> e il generatore CLI via require.
const require = createRequire(import.meta.url);
const { CANON, parseAnnualText, parseBulletin, parseSabatoPomeriggio } = require('../turni-parser.js');

const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const leggi = (f) => readFileSync(join(DATA, f), 'utf8');

describe('CANON — nomi canonici e rinominamenti', () => {
  it('rinomina Pegazzano: sia il nome vecchio che il nuovo puntano a "Del Fico"', () => {
    expect(CANON['CAMPODONICO']).toBe('Del Fico');
    expect(CANON['DEL FICO']).toBe('Del Fico');
  });
  it('alias storici noti', () => {
    expect(CANON['ALLENAZA']).toBe('Alleanza');     // refuso OCR del PDF annuale
    expect(CANON['ARGENITERI']).toBe('Argentieri'); // refuso OCR del PDF annuale
  });
});

describe('parseAnnualText — calendario annuale dal PDF ufficiale 2026', () => {
  const { turni, problemi } = parseAnnualText(leggi('sorgente-turni-2026.txt'), 2026);

  it('riconosce tutti i 365 giorni senza problemi', () => {
    expect(problemi).toEqual([]);
    expect(Object.keys(turni)).toHaveLength(365);
  });

  it('rigenerato dal sorgente == base committata data/turni-2026.json', () => {
    const base = JSON.parse(leggi('turni-2026.json'));
    expect(turni).toEqual(base);
  });
});

describe('parseBulletin — bollettini settimanali reali (fixture estratte da PDF)', () => {
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
      // Formato 2026: nuova farmacia "Del Fico", "Di Marola", "Felia Prione (Bedini)".
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
      // Settimana in cui "Del Fico" (ex Campodonico) è di turno.
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

  for (const caso of CASI) {
    it(`${caso.file} → giorni corretti, 0 problemi`, () => {
      const { turni, problemi } = parseBulletin(leggi(caso.file));
      expect(turni).toEqual(caso.atteso);
      expect(problemi).toEqual([]);
    });
  }
});

describe('parseSabatoPomeriggio — documento "Farmacie aperte sabato pomeriggio"', () => {
  it('20/06/2026: data, orario ed elenco (con Del Porto)', () => {
    const r = parseSabatoPomeriggio(leggi('esempio-sabato-2026-06-20.txt'));
    expect(r.problemi).toEqual([]);
    expect(r.data).toBe('2026-06-20');
    expect(r.orario).toBe('15:30–19:30');
    expect(r.farmacie).toEqual([
      'Argentieri', 'Beretta', 'Bonaschi', 'Centrale', 'Croce Bianca', 'Croce Rossa',
      'Croce Verde', 'Del Porto', 'Degli Speziali', 'Della Marina', 'Della Stazione',
      'Di Marola', 'Di Prima', 'Farina', 'Farmaceutica', 'Felia Prione', 'Internazionale',
      'Maglio', 'Maimone', 'Tapparo', 'Tarantola',
    ]);
  });

  it('13/06/2026: variante con Dell\'Arsenale al posto di Del Porto', () => {
    const r = parseSabatoPomeriggio(leggi('esempio-sabato-2026-06-13.txt'));
    expect(r.problemi).toEqual([]);
    expect(r.data).toBe('2026-06-13');
    expect(r.farmacie).toContain("Dell'Arsenale");
    expect(r.farmacie).not.toContain('Del Porto');
    expect(r.farmacie).toHaveLength(21);
  });

  it('non confonde i nomi-via con le farmacie: "Migliarina" è solo in un indirizzo, non tra le aperte', () => {
    const r = parseSabatoPomeriggio(leggi('esempio-sabato-2026-06-20.txt'));
    expect(r.farmacie).not.toContain('Migliarina');
  });

  it('"Di Marola" e "Maimone" sono due farmacie distinte (non il turno composto)', () => {
    const r = parseSabatoPomeriggio(leggi('esempio-sabato-2026-06-20.txt'));
    expect(r.farmacie).toContain('Di Marola');
    expect(r.farmacie).toContain('Maimone');
    expect(r.farmacie).not.toContain('Di Marola/Maimone');
  });
});
