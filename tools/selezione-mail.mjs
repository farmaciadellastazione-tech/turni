// selezione-mail.mjs — logica pura per riconoscere gli allegati utili
// nelle mail di Federfarma La Spezia.
//
// Federfarma manda quasi ogni giorno circolari (ritiri lotti, DPC, avvisi ASL…)
// con PDF e .docx in allegato: prendere "l'allegato più recente" pesca quasi
// sempre una circolare. La mail giusta si riconosce dall'oggetto
// ("TURNI COMUNE DELLA SPEZIA DAL … AL …") e i doc del sabato dal nome file
// ("SABATO POMERIGGIO <data>.doc"). Una stessa mail può portare più bollettini
// (uno per settimana) e più doc sabato: si restituiscono tutti.
//
// Testato in tests/selezione-mail.test.js.

// PDF di bollettino: solo dalla mail dei turni, escludendo un eventuale
// elenco sabato inviato in PDF (va al flusso sabato, non a parseBulletin).
// Oltre a "TURNI"/"SPEZIA" si richiede l'intervallo "DAL … AL …", sempre
// presente nell'oggetto del bollettino vero: senza, mail amministrative che
// nominano solo di sfuggita turni e Spezia (es. un sollecito del Comune sul
// calendario dell'anno dopo) passerebbero il filtro e, non avendo il formato
// turno-per-giorno, farebbero estrarre 0 giorni al parser (bug reale, 4 run
// rossi consecutivi ad ago 2026 prima che arrivasse la mail vera).
export function allegatiBollettino(oggetto, nomiAllegati) {
  const ogg = oggetto || '';
  if (!/\bTURNI\b/i.test(ogg) || !/SPEZIA/i.test(ogg) || !/\bDAL\b.*\bAL\b/i.test(ogg)) return [];
  return (nomiAllegati || []).filter(n => /\.pdf$/i.test(n || '') && !/SABATO/i.test(n));
}

// Elenco "SABATO POMERIGGIO": riconosciuto dal nome file, in qualunque mail
// di Federfarma arrivi (di norma viaggia con la mail dei turni). Come l'import
// manuale dall'editor, si accetta sia il .doc Word sia il PDF.
export function allegatiSabato(nomiAllegati) {
  return (nomiAllegati || []).filter(n => /SABATO/i.test(n || '') && /\.(docx?|pdf)$/i.test(n));
}

// Un .docx è un archivio zip (firma PK\x03\x04): la lettura windows-1252 usata
// per i .doc binari produrrebbe spazzatura, meglio riconoscerlo e dirlo chiaro.
export function sembraDocx(buf) {
  return !!buf && buf.length >= 4 &&
    buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;
}

// Un PDF inizia con "%PDF": si guarda il contenuto, non l'estensione, così il
// routing doc/PDF in apply-sabato funziona anche con allegati rinominati.
export function sembraPdf(buf) {
  return !!buf && buf.length >= 4 &&
    buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46; // %PDF
}

// Calendario turni ANNUALE (bozza a settembre, ufficiale/ordinanza a gennaio):
// non si importa da solo (arriva in Word, una volta l'anno, e va controllato),
// ma l'automazione avvisa il titolare quando arriva. Si riconosce dall'allegato
// "all. 2 - CALENDARIO TURNI [SP] ANNO <anno>" — stabile da anni — e non dal
// semplice "calendario 2027.pdf" dei solleciti estivi (che non è il calendario).
// Solo anni >= anno corrente: il definitivo può arrivare ad anno già iniziato.
// Ritorna { anno, tipo: 'bozza'|'ufficiale'|'non specificato', allegato } o null.
export function calendarioAnnuale(oggetto, nomiAllegati, annoCorrente) {
  for (const nome of nomiAllegati || []) {
    // Niente \b: "_" è un carattere di parola e "CALENDARIO_TURNI_SP_ANNO_2027" non matcherebbe.
    const m = /CALENDARIO[\s_-]*TURNI(?![A-Z]).*?(?<!\d)(20\d\d)(?!\d)/i.exec(nome || '');
    if (!m || !/\.(docx?|pdf|xlsx?)$/i.test(nome)) continue;
    const anno = parseInt(m[1], 10);
    if (anno < annoCorrente) continue;
    const ogg = oggetto || '';
    const tipo = /\bbozza\b/i.test(ogg) ? 'bozza'
      : /ufficial|ordinanza|definitiv/i.test(ogg) ? 'ufficiale'
      : 'non specificato';
    return { anno, tipo, allegato: nome };
  }
  return null;
}
