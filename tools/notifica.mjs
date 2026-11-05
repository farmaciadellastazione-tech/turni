// notifica.mjs — logica pura della mail di notifica degli aggiornamenti automatici.
//
// Flusso nel workflow giornaliero:
//   apply-bollettino.mjs / apply-sabato.mjs  -> registraEvento(...)  (solo se il Gist cambia)
//   notifica-aggiornamento.mjs (ultimo passo) -> leggiEventi() + componiNotifica() + invio
//
// Si manda una mail SOLO se qualcosa è cambiato o se il giro è fallito: nei giorni
// senza novità nessun messaggio. Testato in tests/notifica.test.js.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

export const FILE_EVENTI = process.env.NOTIFICA_FILE || '.notifica-aggiornamento.json';

export function leggiEventi(file = FILE_EVENTI) {
  if (!existsSync(file)) return [];
  try { const v = JSON.parse(readFileSync(file, 'utf8')); return Array.isArray(v) ? v : []; }
  catch { return []; }
}

// Evento: { tipo:'bollettino', giorni:[{data,t,c?,prima}] } | { tipo:'sabato', sabati:[{data,orario,farmacie}] }
export function registraEvento(evento, file = FILE_EVENTI) {
  const eventi = leggiEventi(file);
  eventi.push(evento);
  writeFileSync(file, JSON.stringify(eventi, null, 2));
}

const GG = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
// '2026-11-15' -> '15/11' ; con giorno della settimana -> 'dom 15/11'
function dm(data) { const [, m, g] = data.split('-'); return `${g}/${m}`; }
function gdm(data) { return `${GG[new Date(data + 'T12:00:00Z').getUTCDay()]} ${dm(data)}`; }

export function componiNotifica({ eventi, fallito, urlRun }) {
  const giorni = eventi.filter(e => e.tipo === 'bollettino').flatMap(e => e.giorni || [])
    .sort((a, b) => a.data.localeCompare(b.data));
  const sabati = eventi.filter(e => e.tipo === 'sabato').flatMap(e => e.sabati || [])
    .sort((a, b) => a.data.localeCompare(b.data));
  if (!giorni.length && !sabati.length && !fallito) return null;

  const parti = [];
  if (giorni.length) parti.push(`Turni aggiornati: ${dm(giorni[0].data)}–${dm(giorni[giorni.length - 1].data)}`);
  if (sabati.length) parti.push(`${giorni.length ? 'sabato' : 'Sabato pomeriggio aggiornato:'} ${sabati.map(s => dm(s.data)).join(', ')}`);

  let oggetto;
  if (fallito) oggetto = '⚠ Aggiornamento turni non riuscito' + (parti.length ? ' (in parte applicato)' : '');
  else oggetto = '✅ ' + parti.join(' · ');

  const righe = [];
  if (fallito) {
    righe.push('Il giro automatico di oggi è terminato con un errore.',
      'La bacheca continua a mostrare i dati già presenti; apri il giro su GitHub per i dettagli',
      '(oppure inoltra questa mail a Claude).', '');
  }
  if (giorni.length) {
    righe.push(`Bollettino applicato — ${giorni.length} giorn${giorni.length === 1 ? 'o modificato' : 'i modificati'}:`);
    for (const g of giorni) {
      const prima = g.prima && g.prima.t && g.prima.t !== g.t ? ` (prima: ${g.prima.t})` : '';
      righe.push(`  ${gdm(g.data)}  ${g.t}${g.c ? ` — conturno ${g.c}` : ''}${prima}`);
    }
    righe.push('');
  }
  if (sabati.length) {
    righe.push('Sabato pomeriggio:');
    for (const s of sabati) righe.push(`  ${gdm(s.data)} (${s.orario}): ${(s.farmacie || []).join(', ')}`);
    righe.push('');
  }
  if (urlRun) righe.push(`Dettagli del giro: ${urlRun}`);
  righe.push('', '— Automazione bacheca turni (GitHub Actions)');
  return { oggetto, testo: righe.join('\n') };
}
