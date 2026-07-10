import { describe, it, expect } from 'vitest';

// Rete di sicurezza dell'automazione: qualunque miss dei filtri di selezione
// (oggetto riformulato, formato nuovo, mail persa) degrada a "run verde, bacheca
// stantia". verificaCopertura controlla che i dati sul Gist coprano ancora il
// periodo corrente e fa fallire il workflow in caso contrario.
import { verificaCopertura, prossimoSabato } from '../tools/verifica-copertura.mjs';

// Scenario reale: il 10/07/2026 (venerdì) gli override arrivavano solo al 03/07
// perché il bollettino "DAL 10 AL 24 LUGLIO" non era mai stato applicato.
const OVERRIDES_STANTII = { '2026-07-02': { t: 'X' }, '2026-07-03': { t: 'Y' } };
const OVERRIDES_OK = { '2026-07-03': { t: 'Y' }, '2026-07-24': { t: 'Z' } };
const SABATO_OK = { '2026-07-11': { orario: '15:30–20:00', farmacie: ['A'] } };

describe('prossimoSabato', () => {
  it('da venerdì è domani, di sabato è oggi', () => {
    expect(prossimoSabato('2026-07-10')).toBe('2026-07-11'); // venerdì
    expect(prossimoSabato('2026-07-11')).toBe('2026-07-11'); // sabato
    expect(prossimoSabato('2026-07-13')).toBe('2026-07-18'); // lunedì
  });
});

describe('verificaCopertura — override del bollettino', () => {
  it('override fino a fine periodo futuro: tutto ok', () => {
    const { ok, problemi } = verificaCopertura({ overrides: OVERRIDES_OK, sabato: SABATO_OK, oggi: '2026-07-10' });
    expect(problemi).toEqual([]);
    expect(ok).toBe(true);
  });

  it("override fermi al passato: fallisce (l'incidente di luglio 2026)", () => {
    const { ok, problemi } = verificaCopertura({ overrides: OVERRIDES_STANTII, sabato: SABATO_OK, oggi: '2026-07-10' });
    expect(ok).toBe(false);
    expect(problemi.join(' ')).toMatch(/2026-07-03/);
  });

  it('override vuoti o mancanti: fallisce (copertura ignota)', () => {
    expect(verificaCopertura({ overrides: {}, sabato: SABATO_OK, oggi: '2026-07-10' }).ok).toBe(false);
    expect(verificaCopertura({ overrides: null, sabato: SABATO_OK, oggi: '2026-07-10' }).ok).toBe(false);
  });
});

describe('verificaCopertura — sabato pomeriggio', () => {
  it('sabato imminente coperto: ok', () => {
    expect(verificaCopertura({ overrides: OVERRIDES_OK, sabato: SABATO_OK, oggi: '2026-07-10' }).ok).toBe(true);
  });

  it('sabato imminente (entro 2 giorni) scoperto: fallisce', () => {
    // giovedì 16, venerdì 17 e sabato 18 senza dati per sabato 18/07
    for (const oggi of ['2026-07-16', '2026-07-17', '2026-07-18']) {
      const { ok, problemi } = verificaCopertura({ overrides: OVERRIDES_OK, sabato: SABATO_OK, oggi });
      expect(ok, oggi).toBe(false);
      expect(problemi.join(' ')).toMatch(/2026-07-18/);
    }
  });

  it('sabato lontano (più di 2 giorni) scoperto: nessun allarme, la mail deve ancora arrivare', () => {
    // lunedì 13 → prossimo sabato 18: mancano 5 giorni, la mail bisettimanale arriva dopo
    expect(verificaCopertura({ overrides: OVERRIDES_OK, sabato: SABATO_OK, oggi: '2026-07-13' }).ok).toBe(true);
  });
});
