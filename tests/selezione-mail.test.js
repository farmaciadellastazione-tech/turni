import { describe, it, expect } from 'vitest';

// Logica pura di selezione degli allegati dalle mail di Federfarma:
// serve al workflow di automazione per distinguere la mail dei turni
// dalle circolari quotidiane (ritiri lotti, DPC, avvisi ASL…), che sono
// anch'esse piene di PDF e .docx e arrivano quasi ogni giorno.
import { allegatiBollettino, allegatiSabato } from '../tools/selezione-mail.mjs';

// Allegati reali della mail "TURNI COMUNE DELLA SPEZIA DAL 10 LUGLIO 2026 AL 24 LUGLIO 2026"
const MAIL_TURNI = {
  oggetto: 'TURNI COMUNE DELLA SPEZIA DAL 10 LUGLIO 2026 AL 24 LUGLIO 2026',
  allegati: [
    'image001.png',
    '10 LUGLIO 2026 - 17 LUGLIO 2026.pdf',
    '17 LUGLIO 2026 -24 LUGLIO 2026.pdf',
    'SABATO POMERIGGIO 11  LUGLIO 2026.doc',
    'SABATO POMERIGGIO 18 LUGLIO 2026.doc',
  ],
};

// Allegati reali di una circolare quotidiana (mail del 10/07/2026, quella che
// mandava in errore il workflow prendendo "162-ALL. 1.docx" per un doc sabato)
const MAIL_CIRCOLARE = {
  oggetto: '162 -RIF - ASSINDE SRL - AVVISO APERTURA I TRANCHE 2026',
  allegati: [
    'image001.png',
    '162 -RIF - ASSINDE SRL - AVVISO APERTURA I TRANCHE 2026.pdf',
    '162-ALL. 1.docx',
    '162-ALL. 2.pdf',
  ],
};

describe('allegatiBollettino — PDF dei turni solo dalla mail giusta', () => {
  it('dalla mail TURNI estrae tutti i PDF di bollettino (uno per settimana)', () => {
    expect(allegatiBollettino(MAIL_TURNI.oggetto, MAIL_TURNI.allegati)).toEqual([
      '10 LUGLIO 2026 - 17 LUGLIO 2026.pdf',
      '17 LUGLIO 2026 -24 LUGLIO 2026.pdf',
    ]);
  });

  it('ignora i PDF delle circolari (oggetto non di turni)', () => {
    expect(allegatiBollettino(MAIL_CIRCOLARE.oggetto, MAIL_CIRCOLARE.allegati)).toEqual([]);
  });

  it('non scambia per bollettino un eventuale elenco sabato in PDF', () => {
    expect(allegatiBollettino(MAIL_TURNI.oggetto, [
      'SABATO POMERIGGIO 11 LUGLIO 2026.pdf',
      '10 LUGLIO 2026 - 17 LUGLIO 2026.pdf',
    ])).toEqual(['10 LUGLIO 2026 - 17 LUGLIO 2026.pdf']);
  });

  it('mail di risposta sui turni senza allegati → nessun candidato', () => {
    expect(allegatiBollettino('R: TURNI COMUNE DELLA SPEZIA DAL 26 GIUGNO 2026 AL 10 LUGLIO 2026', ['image001.png'])).toEqual([]);
  });
});

describe('allegatiSabato — solo i .doc "SABATO POMERIGGIO"', () => {
  it('dalla mail TURNI estrae tutti i doc sabato (uno per sabato)', () => {
    expect(allegatiSabato(MAIL_TURNI.allegati)).toEqual([
      'SABATO POMERIGGIO 11  LUGLIO 2026.doc',
      'SABATO POMERIGGIO 18 LUGLIO 2026.doc',
    ]);
  });

  it('ignora i .docx delle circolari', () => {
    expect(allegatiSabato(MAIL_CIRCOLARE.allegati)).toEqual([]);
  });
});
