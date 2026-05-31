# Turni — Farmacia della Stazione

Bacheca digitale delle **farmacie di turno** della Spezia, pensata per essere mostrata su uno schermo in farmacia e aggiornabile da remoto (anche da telefono).

Online su GitHub Pages: <https://farmaciadellastazione-tech.github.io/turni/>

---

## Com'è fatto

Il progetto è composto da **due pagine HTML statiche**, senza backend:

| File | A cosa serve |
|------|--------------|
| `index.html` | **Bacheca pubblica** (sola lettura). Mostra la farmacia di turno adesso, i prossimi turni, orologio, mappa, servizi e contatti. Si aggiorna da sola. |
| `edit-turni.html` | **Editor** (mobile-friendly). Calendario per modificare giorno per giorno il turno, il conturno, l'orario di fine, aperture straordinarie e note. |

I dati vivono in tre posti:

- **Calendario base dell'anno** → file versionati `data/turni-<anno>.json` (un turno per ogni giorno), generati dal PDF ufficiale dell'Ordine (vedi `tools/`). Le pagine caricano da sole gli anni *precedente / corrente / successivo*.
- **Anagrafica farmacie** → `data/farmacie.json`: indirizzo e telefono di ogni farmacia.
- **Modifiche/eccezioni** → un **GitHub Gist** pubblico con due file: `turni-overrides.json` (solo le differenze rispetto alla base: cambi farmacia, conturno, fine turno, straordinari, note) e `turni-base.json` (base aggiornata da remoto, se presente sostituisce i file versionati).

```
data/turni-<anno>.json (base)  +  overrides (dal Gist)  =  turno mostrato
```

In questo modo il calendario annuale è fisso, e le correzioni dell'ultimo minuto si fanno senza ripubblicare il sito.

### Come si aggiorna la bacheca

1. La bacheca (`index.html`) legge il Gist **senza autenticazione** (il Gist è pubblico) ogni **5 minuti**, e ricarica la pagina ogni notte alle **02:00**.
2. L'editor (`edit-turni.html`) **scrive** sul Gist tramite l'API di GitHub: serve un **token GitHub** con permesso `gist`, che si inserisce nell'apposito campo (viene ricordato nel browser).
3. Dopo il salvataggio, la bacheca recepisce le modifiche **entro 5 minuti**.

### Importare i turni nell'editor

L'editor sa leggere direttamente i PDF ufficiali (estrazione testo con `pdf.js`), tramite il parser condiviso `turni-parser.js`:

- **📅 Importa calendario annuale (PDF)** — dal PDF *"CALENDARIO TURNI SP ANNO ‹anno›"*: ricostruisce l'intera base dell'anno e, col token, la salva sul Gist (`turni-base.json`). Se anche un solo giorno non è riconosciuto, non salva nulla.
- **📋 Importa bollettino settimanale (PDF)** — dal bollettino discorsivo (*"… Diurno e notturno"*): confronta i giorni con la base e propone come **override** solo quelli diversi (le *errata corrige*). Le modifiche restano in sospeso finché non premi 💾 **Salva**.

### Logica dei turni

Il turno di un giorno va dalle **08:30 di quel giorno alle 08:30 del giorno successivo** (orario di fine personalizzabile per ogni giorno). Di conseguenza, prima delle 08:30 la farmacia "di adesso" è ancora quella del giorno prima.

---

## Sviluppo e pubblicazione

- Si lavora sempre sul branch **`dev`**, mai direttamente su `main`.
- Le modifiche si testano su `dev` prima del merge.
- Il merge su `main` (= produzione, pubblicata da GitHub Pages) si fa **solo con conferma esplicita**.

```bash
git checkout dev
# ...modifiche...
git push origin dev
# dopo i test, con conferma:
git checkout main && git merge --no-ff dev && git push origin main
```

---

## Da sviluppare (roadmap)

Idee e funzionalità previste per le prossime versioni:

### Grafica e presentazione
- Rifacimento della **parte grafica** della bacheca: layout più curato, leggibilità da lontano, eventuale tema/branding della farmacia.

### Informazioni sulle farmacie
- **Anagrafica completa di ogni farmacia**: indirizzo e telefono ci sono già in `data/farmacie.json`; resta da aggiungere la **posizione esatta sulla mappa** (e mostrarli in bacheca).
- Mostrare la **farmacia di turno direttamente sulla mappa** (marker dedicato), non solo la nostra.

### Come raggiungere la farmacia
- **Indicazioni e itinerari** verso la farmacia di turno (a piedi, in auto).
- **Mezzi pubblici**: linee, fermate, eventuali collegamenti utili.
- Tempi/distanze stimati dal punto in cui si trova la bacheca.

### Comunicazione e sostenibilità
- Possibilità di **pubblicare contenuti promozionali** su servizi e iniziative della farmacia (es. Holter, ECG, campagne di prevenzione).
- Spazio per **eventuali sponsor** / inserzioni di terzi.

### Tecniche / sicurezza
- **Proxy serverless** per la scrittura sul Gist, così da non esporre più il token GitHub nel browser (vedi nota sotto).
- ✅ ~~Eliminare la duplicazione di `TURNI_BASE`~~ — fatto: la base ora vive in `data/turni-<anno>.json`, condivisi tra le due pagine.

---

## Note tecniche / limitazioni note

- **Token GitHub lato client**: oggi l'editor tiene il token nel `localStorage` del browser. Poiché il sito è ospitato su un origin condiviso con altri progetti Pages dell'organizzazione, è un punto da irrobustire (vedi roadmap → *Proxy serverless*). Usare nel frattempo un token con permessi minimi e scadenza breve.
- **Import bollettino — giorni della settimana senza accento**: il parser riconosce le date-àncora scritte `LUNEDI`, `MARTEDI`… (come nei bollettini ufficiali). Un eventuale bollettino con accento (`MERCOLEDÌ`) farebbe saltare quel giorno. Da irrobustire se dovesse capitare.

---

## Configurazione

Riferimenti usati nel codice:

- **Gist**: ID `8f699fa0fd4566b2bbb2805b76ad482e`, file `turni-overrides.json` (eccezioni) e `turni-base.json` (base aggiornata da remoto, opzionale)
- **Dati versionati**: `data/turni-<anno>.json` (calendario base), `data/farmacie.json` (indirizzo + telefono)
- **Formato override** (esempio):

```json
{
  "overrides": {
    "2026-06-15": { "t": "Beretta", "c": "Tapparo", "fineOra": "09:00", "straord": "Della Stazione 8-20", "nota": "Farmacia X in ferie" }
  }
}
```

Tutti i campi sono opzionali: vengono salvati solo quelli che differiscono dal calendario base.
