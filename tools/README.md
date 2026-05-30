# tools/ — generatore calendario turni

Strumento per costruire il calendario turni di un anno direttamente dal **PDF ufficiale**
dell'Ordine Provinciale Farmacisti di La Spezia ("CALENDARIO TURNI SP ANNO _anno_").

## Preparazione (una volta sola)

Per leggere i PDF serve installare la dipendenza locale:

```bash
cd tools
npm install
```

(crea `tools/node_modules/`, che non viene versionato.)

## Aggiornamento annuale (la procedura)

1. **Salva il PDF** del nuovo anno, ad esempio in `data/calendario-turni-2027.pdf`.
2. **Genera** il calendario passando direttamente il PDF:
   ```bash
   node tools/genera-turni.mjs data/calendario-turni-2027.pdf 2027
   ```
   Crea `data/turni-2027.json` (mappa `data → {t, c?}`), che le pagine caricano da sole.
3. (Consigliato) **Valida** rigenerando un anno già noto e confrontandolo, per verificare
   che il parser interpreti bene il PDF:
   ```bash
   node tools/genera-turni.mjs data/calendario-turni-2026.pdf 2026 --validate data/turni-2026.json
   ```
   Deve stampare `✓ Output identico al riferimento.`

In alternativa al PDF si può passare un file di testo già estratto (`.txt`): l'uso è identico.

## Note

- I nomi delle farmacie vengono **normalizzati** sui nomi canonici (vedi `CANON`
  in `genera-turni.mjs`). Il PDF ufficiale contiene a volte refusi/errori OCR
  (es. `ALLENAZA`, `ARGENITERI`): se ne incontri di nuovi, aggiungi un alias in `CANON`.
- Il campo `c` (conturno) è la farmacia di supporto a orario minimo nei **festivi**;
  viene letto dalla colonna CONTURNO del PDF.
- Se il parser non riconosce un nome, si ferma e segnala il giorno problematico
  invece di scrivere dati sbagliati.

## File

- `genera-turni.mjs` — il generatore/validatore (legge PDF o testo)
- `package.json` / `package-lock.json` — dipendenza `pdf-parse`
- `../data/sorgente-turni-2026.txt` — testo del PDF 2026 (sorgente storica)
- `../data/turni-2026.json` — calendario 2026 generato e validato
