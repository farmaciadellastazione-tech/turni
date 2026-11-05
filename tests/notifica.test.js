import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Notifica via mail degli aggiornamenti automatici (bollettino / sabato pomeriggio):
// gli script apply-* registrano cosa hanno cambiato, l'ultimo passo del workflow
// compone la mail. Qui la logica pura: registrazione eventi e testo della mail.
import { registraEvento, leggiEventi, componiNotifica } from '../tools/notifica.mjs';

const URL_RUN = 'https://github.com/farmaciadellastazione-tech/turni/actions/runs/123';

const BOLLETTINO = {
  tipo: 'bollettino',
  giorni: [
    { data: '2026-11-15', t: 'Croce Verde', c: 'Bergero', prima: null },
    { data: '2026-11-14', t: 'Farina', prima: { t: 'Tapparo' } },
  ],
};
const SABATO = {
  tipo: 'sabato',
  sabati: [{ data: '2026-11-14', orario: '15:30-19:30', farmacie: ['Beretta', 'Centrale'] }],
};

describe('registraEvento / leggiEventi — file di appoggio tra i passi del workflow', () => {
  it('accoda gli eventi nello stesso file e li rilegge in ordine', () => {
    const f = join(mkdtempSync(join(tmpdir(), 'notifica-')), 'eventi.json');
    expect(leggiEventi(f)).toEqual([]);           // file assente -> nessun evento
    registraEvento(BOLLETTINO, f);
    registraEvento(SABATO, f);
    expect(existsSync(f)).toBe(true);
    expect(leggiEventi(f)).toEqual([BOLLETTINO, SABATO]);
    expect(JSON.parse(readFileSync(f, 'utf8'))).toHaveLength(2);
  });
});

describe('componiNotifica — testo della mail', () => {
  it('nessuna modifica e nessun errore -> nessuna mail', () => {
    expect(componiNotifica({ eventi: [], fallito: false, urlRun: URL_RUN })).toBeNull();
  });

  it('bollettino: oggetto con l\'intervallo, giorni in ordine di data con turno e conturno', () => {
    const n = componiNotifica({ eventi: [BOLLETTINO], fallito: false, urlRun: URL_RUN });
    expect(n.oggetto).toBe('✅ Turni aggiornati: 14/11–15/11');
    const iFarina = n.testo.indexOf('14/11'), iCroce = n.testo.indexOf('15/11');
    expect(iFarina).toBeGreaterThan(-1);
    expect(iCroce).toBeGreaterThan(iFarina);         // ordinati per data
    expect(n.testo).toMatch(/sab 14\/11.*Farina.*\(prima: Tapparo\)/);
    expect(n.testo).toMatch(/dom 15\/11.*Croce Verde.*conturno Bergero/);
    expect(n.testo).toContain(URL_RUN);
  });

  it('solo sabato pomeriggio: oggetto e elenco farmacie', () => {
    const n = componiNotifica({ eventi: [SABATO], fallito: false, urlRun: URL_RUN });
    expect(n.oggetto).toBe('✅ Sabato pomeriggio aggiornato: 14/11');
    expect(n.testo).toMatch(/14\/11.*15:30-19:30.*Beretta, Centrale/);
  });

  it('bollettino + sabato nello stesso giro: un\'unica mail', () => {
    const n = componiNotifica({ eventi: [BOLLETTINO, SABATO], fallito: false, urlRun: URL_RUN });
    expect(n.oggetto).toBe('✅ Turni aggiornati: 14/11–15/11 · sabato 14/11');
  });

  it('errore senza modifiche: mail di avviso col link al giro', () => {
    const n = componiNotifica({ eventi: [], fallito: true, urlRun: URL_RUN });
    expect(n.oggetto).toBe('⚠ Aggiornamento turni non riuscito');
    expect(n.testo).toContain(URL_RUN);
  });

  it('errore con modifiche parziali: avviso, ma elenca comunque ciò che è stato applicato', () => {
    const n = componiNotifica({ eventi: [SABATO], fallito: true, urlRun: URL_RUN });
    expect(n.oggetto).toBe('⚠ Aggiornamento turni non riuscito (in parte applicato)');
    expect(n.testo).toContain('Beretta, Centrale');
  });
});
