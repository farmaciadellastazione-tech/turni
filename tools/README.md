# tools/ — generatore calendario turni

Strumento per costruire il calendario turni di un anno a partire dal **PDF ufficiale**
dell'Ordine Provinciale Farmacisti di La Spezia ("CALENDARIO TURNI SP ANNO _anno_").

## Aggiornamento annuale (la procedura)

1. **Ottieni il PDF** del nuovo anno e **estrai il testo** in un file di testo
   (copia-incolla dal PDF, o "salva come testo"). Salvalo come
   `data/sorgente-turni-<anno>.txt`.
2. **Genera** il calendario:
   ```bash
   node tools/genera-turni.mjs data/sorgente-turni-2027.txt 2027
   ```
   Crea `data/turni-2027.json` (mappa `data → {t, c?}`, stessa forma di `TURNI_BASE`).
3. (Consigliato) **Valida** il primo anno contro i dati già noti, per verificare che
   il parser interpreti bene il formato del PDF:
   ```bash
   node tools/genera-turni.mjs data/sorgente-turni-2026.txt 2026 --validate index.html
   ```
   Deve stampare `✓ Output identico a TURNI_BASE.`

## Note

- I nomi delle farmacie vengono **normalizzati** sui nomi canonici (vedi `CANON`
  in `genera-turni.mjs`). Il PDF ufficiale contiene a volte refusi/errori OCR
  (es. `ALLENAZA`, `ARGENITERI`): se ne incontri di nuovi, aggiungi un alias in `CANON`.
- Il campo `c` (conturno) è la farmacia di supporto a orario minimo nei **festivi**;
  viene letto dalla colonna CONTURNO del PDF.
- Se il parser non riconosce un nome, si ferma e segnala il giorno problematico
  invece di scrivere dati sbagliati.

## File

- `genera-turni.mjs` — il generatore/validatore
- `../data/sorgente-turni-2026.txt` — testo del PDF 2026 (sorgente)
- `../data/turni-2026.json` — calendario 2026 generato e validato
