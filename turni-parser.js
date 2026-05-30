// Parser condiviso del calendario turni (Ordine Provinciale Farmacisti – La Spezia).
// Usato sia dallo strumento locale (tools/genera-turni.mjs, via require) sia dal
// browser (edit-turni.html, via <script src="turni-parser.js">).
//
// Espone TurniParser.parseAnnualText(testo, anno) -> { turni: {dataKey:{t,c?}}, problemi:[...] }
// dal testo del PDF "CALENDARIO TURNI SP ANNO <anno>".

(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TurniParser = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {

  // Nomi canonici (identici a quelli usati dalle pagine) + alias per refusi/OCR del PDF annuale.
  const CANON = {
    'CROCE ROSSA': 'Croce Rossa', 'CROCE BIANCA': 'Croce Bianca', 'CROCE VERDE': 'Croce Verde',
    'DI MAROLA/MAIMONE': 'Di Marola/Maimone', 'ALLEANZA': 'Alleanza', 'BERETTA': 'Beretta',
    'ARGENTIERI': 'Argentieri', 'INTERNAZIONALE': 'Internazionale', 'BONASCHI': 'Bonaschi',
    "DELL'ARSENALE": "Dell'Arsenale", "DELL'AQUILA": "Dell'Aquila", 'DI PRIMA': 'Di Prima',
    'CAMPODONICO': 'Campodonico', 'S.TA BARBARA': 'S.ta Barbara', 'SCHIAFFINO': 'Schiaffino',
    'TARANTOLA': 'Tarantola', 'FELIA PRIONE': 'Felia Prione', 'DELLA MARINA': 'Della Marina',
    'DELLA STAZIONE': 'Della Stazione', 'BERGERO': 'Bergero', 'MIGLIARINA': 'Migliarina',
    'MAGLIO': 'Maglio', 'BARACCHINI': 'Baracchini', 'FARMACEUTICA': 'Farmaceutica',
    'FARINA': 'Farina', 'TAPPARO': 'Tapparo', 'CENTRALE': 'Centrale', 'DEL PORTO': 'Del Porto',
    'DEGLI SPEZIALI': 'Degli Speziali',
    // alias OCR / refusi noti
    'ALLENAZA': 'Alleanza', 'DI MAROLA/MAIOMONE': 'Di Marola/Maimone', 'ARGENITERI': 'Argentieri',
  };

  const WD = new Set(['LUNEDI', 'MARTEDI', 'MERCOLEDI', 'GIOVEDI', 'VENERDI', 'SABATO', 'DOMENICA']);
  const MESI = ['GENNAIO', 'FEBBRAIO', 'MARZO', 'APRILE', 'MAGGIO', 'GIUGNO', 'LUGLIO', 'AGOSTO',
    'SETTEMBRE', 'OTTOBRE', 'NOVEMBRE', 'DICEMBRE'];
  const WD_RE = new RegExp('(' + Array.from(WD).join('|') + ')\\d+$');

  // Match goloso di un nome di farmacia a partire dai token i: prova 2 token, poi 1.
  function matchName(tokens, i) {
    for (const len of [2, 1]) {
      const key = tokens.slice(i, i + len).join(' ');
      if (CANON[key]) return { name: CANON[key], used: len };
    }
    return null;
  }

  function parseAnnualText(rawText, anno) {
    const txt = String(rawText).replace(/\r\n?/g, '\n').replace(/’/g, "'");
    const ANNO = parseInt(anno, 10);
    const parsed = {};
    const problemi = [];

    function bodyOf(mese, idx) {
      const start = txt.indexOf('\n' + mese + '\n');
      if (start === -1) throw new Error('Mese non trovato nel testo: ' + mese);
      let end;
      if (idx < 11) end = txt.indexOf('\n' + MESI[idx + 1] + '\n', start + 1);
      else end = txt.indexOf('GENNAIO ' + (ANNO + 1));
      return txt.slice(start + mese.length + 2, end === -1 ? undefined : end);
    }

    MESI.forEach((mese, idx) => {
      const body = bodyOf(mese, idx);
      const toks = body.split(/\s+/).map(t => t.replace(WD_RE, '$1')).filter(Boolean);
      const wIdx = [];
      toks.forEach((t, i) => { if (WD.has(t)) wIdx.push(i); });

      wIdx.forEach((w, k) => {
        const giorno = parseInt(toks[w - 1], 10);
        if (!giorno) return;
        const stop = (k + 1 < wIdx.length) ? wIdx[k + 1] - 1 : toks.length;
        const nameToks = toks.slice(w + 1, stop).filter(t => !/^[1-9]$/.test(t));

        const names = [];
        let i = 0;
        while (i < nameToks.length && names.length < 2) {
          const m = matchName(nameToks, i);
          if (!m) break;
          names.push(m.name);
          i += m.used;
        }
        if (!names.length) {
          problemi.push(ANNO + '-' + (idx + 1) + '-' + giorno + ': nessun nome riconosciuto (token: ' + nameToks.join('|') + ')');
          return;
        }
        const key = ANNO + '-' + String(idx + 1).padStart(2, '0') + '-' + String(giorno).padStart(2, '0');
        const rec = { t: names[0] };
        if (names[1]) rec.c = names[1];
        parsed[key] = rec;
      });
    });

    return { turni: parsed, problemi };
  }

  return { CANON, parseAnnualText };
});
