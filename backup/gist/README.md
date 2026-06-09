# Snapshot del Gist (override/dati editabili)

Copia di sicurezza versionata del contenuto del **Gist pubblico**
(`8f699fa0fd4566b2bbb2805b76ad482e`, owner `farmaciadellastazione-tech`), che
ospita i dati editabili dall'editor. Serve da rete di sicurezza nel caso il Gist
venga manomesso o **cancellato**: il codice e il calendario base sono già
versionati nel repo, mentre questi file vivono solo sul Gist.

## File

- `turni-base.json` — eventuale base annuale pubblicata dall'editor (se presente, vince sul seed `data/turni-<anno>.json` del repo)
- `turni-overrides.json` — eccezioni per singolo giorno (`{ overrides: { "YYYY-MM-DD": {...} } }`)
- `contenuti.json` — servizi, annunci, impostazioni ticker
- `farmacie-pos.json` — coordinate mappa per farmacia
- `farmacie.json` — copia anagrafica (fallback; la fonte di verità resta `data/farmacie.json` nel repo)

## Come aggiornare lo snapshot

Rieseguire lo scaricamento dai raw URL del Gist e ricommittare (vedi cronologia
del commit che ha introdotto questa cartella). È una **foto al momento del
commit**: per ripristinare, ricaricare questi file sul Gist tramite l'editor o
l'API GitHub.

> Nota: i Gist sono repository git e mantengono lo storico delle revisioni, quindi
> una *modifica* malevola è già reversibile dal Gist stesso. Questo snapshot copre
> il caso peggiore in cui il Gist venga *eliminato* del tutto.
