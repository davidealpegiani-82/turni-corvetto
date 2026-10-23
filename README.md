# Turni Corvetto v9.11.31 — sviluppo e deploy

## Pubblicazione in 2 minuti

### Opzione A — Drag & drop (più semplice)
1. Vai su https://app.netlify.com/drop
2. Trascina l’intera cartella `corvetto-netlify` (o solo `index.html`)
3. Netlify ti dà un URL tipo `https://random-name.netlify.app`

### Opzione B — Account Netlify + Git
1. Crea un repo GitHub con questa cartella
2. Su Netlify: **Add new site → Import an existing project**
3. Collega il repo, lascia vuoto il build command, publish directory = `.` (o `corvetto-netlify` se è in sottocartella)
4. Deploy

### Dopo il deploy
- Apri l’URL HTTPS dal telefono o PC
- Firebase sync dovrebbe funzionare (non più “file locale”)
- Aggiungi il sito alla home (PWA / “Aggiungi a schermata Home”)

### Dominio personalizzato (opzionale)
Site settings → Domain management → Add custom domain

## Contenuto
- `index.html` — app completa (turni, ferie, impegni, PDF, regole)
- `netlify.toml` — header di sicurezza e SPA fallback


## Stato versione 9.11.31
- Audit coperture finale: conteggio del personale di magazzino attivo anche quando non appartiene alle coppie storiche o al ruolo jolly.
- Sincronizzazione cloud con controllo della revisione per evitare sovrascritture concorrenti silenziose.
- La versione 9.11.31 è attualmente sul ramo di sviluppo `fix/v9.11.29-coperture-selezione`; non è da considerarsi pubblicata sul sito principale finché non viene verificata e integrata.
- I controlli automatici di sintassi non sostituiscono le prove reali di generazione turni, sincronizzazione multi-dispositivo e ripristino dei dati.
