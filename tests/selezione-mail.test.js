import { describe, it, expect } from 'vitest';

// Logica pura di selezione degli allegati dalle mail di Federfarma:
// serve al workflow di automazione per distinguere la mail dei turni
// dalle circolari quotidiane (ritiri lotti, DPC, avvisi ASL…), che sono
// anch'esse piene di PDF e .docx e arrivano quasi ogni giorno.
import { allegatiBollettino, allegatiSabato, sembraDocx, sembraPdf, calendarioAnnuale } from '../tools/selezione-mail.mjs';

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

  // Bug reale (18-21 ago 2026): questo sollecito amministrativo del Comune
  // contiene sia "TURNI" che "SPEZIA" nell'oggetto ma non è il bollettino —
  // veniva scelto comunque, il PDF non aveva il formato turno-per-giorno e
  // il parser estraeva 0 giorni (run rosso per 4 giorni finché non è arrivata
  // la vera mail turni). Il bollettino vero ha sempre un intervallo "DAL … AL …".
  it('ignora un sollecito amministrativo che nomina TURNI/SPEZIA senza intervallo DAL...AL...', () => {
    expect(allegatiBollettino('SOLLECITO RISPOSTA TURNI 2027 COMUNE DELLA SPEZIA', ['calendario 2027.pdf'])).toEqual([]);
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

  it("accetta l'elenco sabato anche in PDF (formato supportato dall'import manuale)", () => {
    expect(allegatiSabato([
      'image001.png',
      '10 LUGLIO 2026 - 17 LUGLIO 2026.pdf',
      'SABATO POMERIGGIO 11 LUGLIO 2026.pdf',
    ])).toEqual(['SABATO POMERIGGIO 11 LUGLIO 2026.pdf']);
  });
});

describe('sembraPdf — riconosce i PDF dal magic number', () => {
  it('un PDF inizia con %PDF', () => {
    expect(sembraPdf(Buffer.from('%PDF-1.7\n...'))).toBe(true);
  });

  it('doc Word o buffer corto non sono PDF', () => {
    expect(sembraPdf(Buffer.from([0xd0, 0xcf, 0x11, 0xe0]))).toBe(false);
    expect(sembraPdf(Buffer.alloc(0))).toBe(false);
  });
});

describe('sembraDocx — riconosce i .docx (zip OOXML) illeggibili come windows-1252', () => {
  it('un .docx inizia con la firma zip PK\\x03\\x04', () => {
    expect(sembraDocx(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]))).toBe(true);
  });

  it('un .doc binario Word (firma OLE D0CF11E0) non è un docx', () => {
    expect(sembraDocx(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1]))).toBe(false);
  });

  it('buffer vuoto o troppo corto non è un docx', () => {
    expect(sembraDocx(Buffer.alloc(0))).toBe(false);
    expect(sembraDocx(Buffer.from([0x50]))).toBe(false);
  });
});

// Mail reali di Federfarma col calendario turni annuale (bozza a settembre,
// ufficiale a gennaio) e mail che NON devono far scattare l'avviso.
describe('calendarioAnnuale — riconosce la mail del calendario turni annuale', () => {
  const BOZZA_2027 = {
    oggetto: 'prot. n. 2025--bozza turni, orari, ferie e aperture straordinarie anno 2027',
    allegati: [
      'image001.png',
      'prot. n. 2025--bozza turni, orari, ferie e aperture straordinarie anno 2027.pdf',
      'a-bozza delibera turni anno 2027.doc',
      'all. 1 - orari-ferie-aperture straordinarie 2027 - comune della Spezia.xls',
      'all. 2 - CALENDARIO TURNI ANNO 2027.doc',
      'all. 3-aperture sabato pomeriggio 2027.xls',
    ],
  };
  const UFFICIALE_2025 = {
    oggetto: 'Ordinanza Turni farmacie Comune della Spezia anno 2025',
    allegati: [
      'ord_00192_31-12-2024.pdf',
      'all. 1-orari-ferie-aperture straordinarie 2025 - comune della Spezia.pdf',
      'all. 2- CALENDARIO TURNI SP ANNO 2025.pdf',
      'all. 3-aperture sabato pomeriggio 2025.pdf',
    ],
  };

  it('bozza 2027 (24/09/2026): anno, tipo "bozza" e allegato giusto', () => {
    expect(calendarioAnnuale(BOZZA_2027.oggetto, BOZZA_2027.allegati, 2026)).toEqual({
      anno: 2027, tipo: 'bozza', allegato: 'all. 2 - CALENDARIO TURNI ANNO 2027.doc',
    });
  });

  it('ordinanza ufficiale 2025 (31/12/2024): tipo "ufficiale"', () => {
    expect(calendarioAnnuale(UFFICIALE_2025.oggetto, UFFICIALE_2025.allegati, 2024)).toEqual({
      anno: 2025, tipo: 'ufficiale', allegato: 'all. 2- CALENDARIO TURNI SP ANNO 2025.pdf',
    });
  });

  it('"Turni 2026 farmacie Comune della Spezia - ufficiali" -> tipo "ufficiale"', () => {
    const r = calendarioAnnuale('Turni 2026 farmacie Comune della Spezia - ufficiali',
      ['all. 2- CALENDARIO TURNI SP ANNO 2026.pdf'], 2026);
    expect(r).toMatchObject({ anno: 2026, tipo: 'ufficiale' });
  });

  it('il definitivo che arriva ad anno in corso conta ancora (anno == anno corrente)', () => {
    expect(calendarioAnnuale(UFFICIALE_2025.oggetto, UFFICIALE_2025.allegati, 2025)).toMatchObject({ anno: 2025 });
  });

  it('un calendario di un anno già passato non fa scattare l\'avviso', () => {
    expect(calendarioAnnuale(UFFICIALE_2025.oggetto, UFFICIALE_2025.allegati, 2026)).toBeNull();
  });

  it('sollecito di agosto: "calendario 2027.pdf" non è il calendario TURNI', () => {
    expect(calendarioAnnuale('SOLLECITO RISPOSTA   TURNI 2027 COMUNE DELLA SPEZIA',
      ['TURNI 2027 COMUNE DELLA SPEZIA.doc', 'all. 1  RIEPILOGO  2027.doc', 'calendario 2027.pdf'], 2026)).toBeNull();
  });

  it('circolare "NUOVO CALENDARIO SUPERFESTIVI" (28/07/2026) non è il calendario turni', () => {
    expect(calendarioAnnuale('prot. n. 194 del 28.07.26 - NUOVO CALENDARIO SUPERFESTIVI FARMACIE SP A PARTIRE DAL 2027', [
      'prot. n. 194 del 28.07.26 - NUOVO CALENDARIO SUPERFESTIVI FARMACIE SP A PARTIRE DAL 2027.pdf',
      'prot. n. 194 del 28.07.26 - all. 1 -NUOVO schema rotazione superfestivi a 14 fino al 2035.pdf',
    ], 2026)).toBeNull();
  });

  it('bollettino settimanale e circolari -> null', () => {
    expect(calendarioAnnuale(MAIL_TURNI.oggetto, MAIL_TURNI.allegati, 2026)).toBeNull();
    expect(calendarioAnnuale(MAIL_CIRCOLARE.oggetto, MAIL_CIRCOLARE.allegati, 2026)).toBeNull();
  });

  it('nomi file con underscore al posto degli spazi (es. CALENDARIO_TURNI_SP_ANNO_2027.docx)', () => {
    expect(calendarioAnnuale('bozza turni 2027', ['CALENDARIO_TURNI_SP_ANNO_2027.docx'], 2026))
      .toMatchObject({ anno: 2027, tipo: 'bozza' });
  });

  it('tipo "non specificato" se l\'oggetto non dice bozza/ufficiale', () => {
    expect(calendarioAnnuale('Turni farmacie', ['CALENDARIO TURNI ANNO 2028.pdf'], 2027))
      .toEqual({ anno: 2028, tipo: 'non specificato', allegato: 'CALENDARIO TURNI ANNO 2028.pdf' });
  });
});
