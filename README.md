# Turni Corvetto v9.11.35 — sviluppo e deploy

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


## Stato versione 9.11.35
- Audit finale delle coperture: include il personale di magazzino attivo anche se non appartiene alle coppie storiche o al ruolo jolly.
- Audit coperture ufficio con pool esplicito e regola speciale del mercoledì: contano solo Alpegiani, Caregnato e Severin; Finiture e altri profili non possono mascherare una scopertura.
- Sincronizzazione cloud con controllo della revisione per segnalare conflitti invece di indicare falsamente una sincronizzazione riuscita.
- La versione 9.11.35 è sul ramo di sviluppo `fix/v9.11.29-coperture-selezione`; non è da considerarsi pubblicata sul sito principale finché non viene verificata e integrata.
- I controlli di sintassi non sostituiscono le prove reali di generazione turni, sincronizzazione multi-dispositivo e ripristino dei dati.
