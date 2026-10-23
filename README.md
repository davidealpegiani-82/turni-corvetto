# Turni Corvetto v9.11.36 — sviluppo e deploy

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


## Stato versione 9.11.36
- Versioning allineato: `APP_VERSION`, header UI, `VERSION.txt`, service worker e query `sw.js?v=` coincidono.
- Audit coperture: magazzino (anche sabato) e ufficio sul pool rotazione + Severin; Finiture/Idalia non mascherano le scoperture.
- Sync cloud con controllo revisione: in caso di modifica concorrente segnala conflitto invece di un falso "ok".
- Malattia e Ricovero restano distinti in tabella, PDF e stati cella.
- Consigliata comunque una prova rapida: genera proposta, applica, verifica sync su un secondo dispositivo.
