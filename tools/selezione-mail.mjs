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
export function allegatiBollettino(oggetto, nomiAllegati) {
  if (!/\bTURNI\b/i.test(oggetto || '') || !/SPEZIA/i.test(oggetto || '')) return [];
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
