// verifica-copertura.mjs — rete di sicurezza dell'automazione turni.
//
// Uso: node tools/verifica-copertura.mjs   (nessun argomento, nessun secret)
//
// Qualunque miss dei filtri di selezione mail (oggetto riformulato, formato
// nuovo, mail persa) degrada a "nessuna mail trovata" → run verde → bacheca
// stantia senza che nessuno se ne accorga: è successo dal 23/06 al 09/07/2026.
// Questo controllo chiude quel buco: legge i file pubblici del Gist e fallisce
// se i dati non coprono più il periodo corrente, qualunque sia la causa a monte.
//
// Regole:
// - turni-overrides.json: l'ultimo giorno coperto deve essere >= oggi
//   (il bollettino è bisettimanale e la mail nuova arriva prima della scadenza);
// - sabato.json: il sabato imminente (entro 2 giorni, cioè da giovedì) deve
//   avere i suoi dati — più in là niente allarme, la mail deve ancora arrivare.
//
// Exit: 0 = copertura ok · 1 = dati stantii (o Gist illeggibile)

import { pathToFileURL } from 'node:url';

const GIST_ID = '8f699fa0fd4566b2bbb2805b76ad482e';
const GIST_API = `https://api.github.com/gists/${GIST_ID}`;

// Prossimo sabato in formato YYYY-MM-DD (oggi stesso se è sabato).
export function prossimoSabato(oggi) {
  const d = new Date(`${oggi}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + (6 - d.getUTCDay() + 7) % 7);
  return d.toISOString().slice(0, 10);
}

// Logica pura, testata in tests/verifica-copertura.test.js.
export function verificaCopertura({ overrides, sabato, oggi }) {
  const problemi = [];

  const giorni = Object.keys(overrides || {}).sort();
  if (!giorni.length) {
    problemi.push('turni-overrides.json è vuoto: copertura del bollettino ignota.');
  } else if (giorni[giorni.length - 1] < oggi) {
    problemi.push(`turni-overrides.json copre solo fino al ${giorni[giorni.length - 1]}: il bollettino corrente non è stato applicato.`);
  }

  const sab = prossimoSabato(oggi);
  const giorniAlSabato = (new Date(`${sab}T00:00:00Z`) - new Date(`${oggi}T00:00:00Z`)) / 86400000;
  if (giorniAlSabato <= 2 && !(sabato && sabato[sab])) {
    problemi.push(`sabato.json non ha i dati per sabato ${sab}: elenco sabato pomeriggio non applicato.`);
  }

  return { ok: problemi.length === 0, problemi };
}

async function main() {
  // Letto dall'API del Gist (non dal raw CDN gist.githubusercontent.com): l'API
  // risponde con il contenuto corrente senza il ritardo di propagazione della
  // CDN, che nella stessa run può ancora servire la versione precedente per
  // qualche secondo dopo il PATCH fatto dagli step di apply — falso allarme
  // osservato il 24/07/2026.
  let overrides, sabato;
  try {
    const r = await fetch(GIST_API);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const gist = await r.json();
    const leggi = (file) => {
      const content = gist.files?.[file]?.content;
      if (content === undefined) throw new Error(`${file}: file assente nel Gist`);
      return JSON.parse(content);
    };
    ({ overrides } = leggi('turni-overrides.json'));
    sabato = leggi('sabato.json');
  } catch (e) {
    console.error(`Gist non leggibile: ${e.message}`);
    return 1;
  }

  // Data odierna in Italia (il runner è UTC).
  const oggi = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(new Date());

  const { ok, problemi } = verificaCopertura({ overrides, sabato, oggi });
  if (ok) {
    console.log(`✓ Copertura ok al ${oggi}: bollettino e sabato aggiornati.`);
    return 0;
  }
  console.error(`Copertura NON ok al ${oggi}:`);
  problemi.forEach(p => console.error('  ' + p));
  console.error('Controllare la casella Gmail: probabilmente una mail Federfarma non è stata riconosciuta dai filtri.');
  return 1;
}

// Eseguito solo da CLI (i test importano le funzioni senza far partire il fetch).
// process.exitCode (non process.exit) per non troncare l'event loop dopo i fetch.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(code => { process.exitCode = code; }).catch(err => { console.error(err); process.exitCode = 1; });
}
