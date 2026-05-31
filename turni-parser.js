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
    // Normalizza ogni spazio (newline inclusi) a spazio singolo: cosi' il parsing
    // funziona sia col testo di pdf-parse (a capo) sia con pdf.js (frammenti) sia con CRLF.
    const txt = ' ' + String(rawText).replace(/’/g, "'").replace(/\s+/g, ' ').trim() + ' ';
    const ANNO = parseInt(anno, 10);
    const parsed = {};
    const problemi = [];

    // Corpo di un mese: tra l'intestazione del mese e quella del mese successivo
    // (per dicembre, fino a "GENNAIO <anno+1>" o fine testo).
    function bodyOf(mese, idx) {
      const m = ' ' + mese + ' ';
      const start = txt.indexOf(m);
      if (start === -1) throw new Error('Mese non trovato nel testo: ' + mese);
      const from = start + m.length;
      let end;
      if (idx < 11) end = txt.indexOf(' ' + MESI[idx + 1] + ' ', from);
      else end = txt.indexOf(' GENNAIO ' + (ANNO + 1) + ' ', from);
      return txt.slice(from, end === -1 ? undefined : end);
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

  // --- Bollettino settimanale (formato discorsivo) ---
  // I bollettini usano spesso nomi diversi/storici: li mappo sui nomi canonici della base.
  const NUM_MESE = {};
  MESI.forEach((m, i) => { NUM_MESE[m] = i + 1; });

  const BULL_ALIAS = Object.assign({}, CANON, {
    'DI MAROLA': 'Di Marola/Maimone',
    'MAIMONE': 'Di Marola/Maimone',
    'BASTIANI': 'Di Marola/Maimone',
    'BEDINI': 'Felia Prione',
    'CENTRALE AMBROSI': 'Centrale',
    'AMBROSI': 'Centrale',
    'SANTA BARBARA': 'S.ta Barbara',
    'BARBARA': 'S.ta Barbara',
  });

  // Riconosce il nome di farmacia che TERMINA alla fine di `prefix` (prova 3, 2, 1 token).
  function matchNameEnding(prefix) {
    const toks = prefix.toUpperCase().replace(/[^A-Z'./\s]/g, ' ').split(/\s+/).filter(Boolean);
    for (let L = 3; L >= 1; L--) {
      if (toks.length < L) continue;
      const key = toks.slice(toks.length - L).join(' ');
      if (BULL_ALIAS[key]) return { name: BULL_ALIAS[key], raw: key };
    }
    return null;
  }

  // Estrae i turni da un bollettino. Ritorna { turni:{dataKey:{t,c?}}, problemi:[], sconosciuti:[] }.
  function parseBulletin(rawText) {
    const clean = ' ' + String(rawText).replace(/’/g, "'").replace(/[–]/g, '-').replace(/\s+/g, ' ').trim() + ' ';
    const dayRe = new RegExp('(' + Array.from(WD).join('|') + ')\\s+(\\d{1,2})\\s+(' + MESI.join('|') + ')\\s+(\\d{4})', 'gi');
    const anchors = [];
    let m;
    while ((m = dayRe.exec(clean)) !== null) {
      anchors.push({ idx: m.index, end: dayRe.lastIndex, giorno: parseInt(m[2], 10), mese: m[3].toUpperCase(), anno: parseInt(m[4], 10) });
    }
    const turni = {};
    const problemi = [];
    const sconosciuti = [];
    for (let i = 0; i < anchors.length; i++) {
      const a = anchors[i];
      const block = clean.slice(a.end, i + 1 < anchors.length ? anchors[i + 1].idx : undefined);
      const bl = block.replace(/[^A-Za-z0-9'./\s]/g, ' '); // via trattini, asterischi, ecc.
      const key = a.anno + '-' + String(NUM_MESE[a.mese]).padStart(2, '0') + '-' + String(a.giorno).padStart(2, '0');

      // turno/i principale/i: nomi prima di "Diurno e notturno"
      const mains = [];
      const reMain = /diurno e notturno/gi;
      let mm;
      while ((mm = reMain.exec(bl)) !== null) {
        const r = matchNameEnding(bl.slice(0, mm.index));
        if (r) mains.push(r.name);
      }
      // contorno: nome prima di "Dalle ... orario minimo"
      let cont = null;
      const om = bl.toLowerCase().indexOf('orario minimo');
      if (om !== -1) {
        const region = bl.slice(0, om);
        const dpos = region.toLowerCase().lastIndexOf('dalle');
        if (dpos !== -1) { const r = matchNameEnding(region.slice(0, dpos)); if (r) cont = r.name; }
      }

      const uniq = [];
      mains.forEach(n => { if (!uniq.includes(n)) uniq.push(n); });
      if (!uniq.length) { problemi.push(key + ': nessuna farmacia di turno riconosciuta nel blocco'); continue; }
      const rec = { t: uniq.length === 1 ? uniq[0] : uniq.join('/') };
      if (cont && cont !== rec.t) rec.c = cont;
      turni[key] = rec;
    }
    return { turni, problemi, sconosciuti };
  }

  return { CANON, parseAnnualText, parseBulletin };
});
