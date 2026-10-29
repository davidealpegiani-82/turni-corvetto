# Sicurezza e sync — Turni Corvetto (Fase D)

## Situazione attuale (codice app)
- Sync su Firebase RTDB path `turni_data_v47_pdf`
- Conflitti gestiti con `updatedRevision` (transaction)
- L’app **non obbliga il login**: la protezione reale dipende dalle **Security Rules** del progetto Firebase

## Cosa fa la v9.11.59
- Indicatore sync con **revisione** (`r123`)
- Barra conflitto con confronto **Locale rX · Cloud rY**
- Conferma esplicita su «Usa cloud» / «Tieni locale»
- Pulsante **Backup** nella barra conflitto
- Backup JSON arricchito (revision, clientId, timestamp)

## Template regole (`database.rules.example.json`)
Attenzione: attivare `auth != null` **rompe** l’uso attuale finché non abiliti autenticazione (es. Anonymous Auth) e login in app.

Passi consigliati (manuale in Firebase Console):
1. Abilita **Anonymous Authentication** (o Email) nel progetto `turni-corvetto-fca14`
2. Copia le rules da `database.rules.example.json` e pubblicale
3. Solo dopo, aggiungere in app `signInAnonymously()` all’avvio (fase successiva)

Finché non fai questi passi, **non** pubblicare rules con `auth != null`.

### Alternativa soft (senza auth, solo anti-sovrascrizione banale)
```json
{
  "rules": {
    "turni_data_v47_pdf": {
      ".read": true,
      ".write": "!data.exists() || !data.child('updatedRevision').exists() || newData.child('updatedRevision').val() >= data.child('updatedRevision').val()"
    }
  }
}
```
Non è sicurezza reale (chiunque col link può scrivere), ma riduce overwrite con revisioni più vecchie.

## Test consigliati
1. Due dispositivi online → modifica su A → B vede barra conflitto o aggiornamento
2. Su conflitto: Backup → Usa cloud → verifica revisione
3. Su conflitto: Backup → Tieni locale → conferma overwrite cloud
4. Export/import JSON: workers presenti, revision valorizzata
