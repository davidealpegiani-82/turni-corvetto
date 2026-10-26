# Corvetto One — laboratorio isolato

Questo percorso è una prova di una nuova esperienza per la pianificazione della filiale. Non è l'app ufficiale e non va pubblicato come sostituzione.

## Aprire la demo UI
Apri `index.html` in un browser moderno. Mostra dati dimostrativi e interazioni locali. Non usa Firebase, non importa dati reali e non salva turni ufficiali.

## Provare le guardrail del motore
Apri `engine-tests.html` in un browser moderno. Il file carica `engine.js` ed esegue test ripetibili, visualizzando quanti sono superati.

## Modulo engine
`engine.js` è una prima base deterministica di validazione, non un ottimizzatore completo. Controlla:
- completezza dei dati obbligatori;
- identità e assegnazioni;
- orari e sovrapposizioni della stessa persona;
- indisponibilità e competenze esplicite;
- gruppo ufficio ammesso il mercoledì;
- coppie magazzino dichiarate come obbligatorie;
- copertura minima su finestre temporali;
- copertura per competenza (`skillCoverageWindows`), così una presenza numerica non basta se manca la qualifica richiesta;
- candidati sostitutivi soltanto quando disponibilità e skill sono note, senza applicarli automaticamente.

## Contratto di sicurezza
- Dati mancanti o sconosciuti non sono considerati validi.
- Un candidato è un suggerimento da riesaminare, mai un turno già applicato.
- Il motore non contiene credenziali, URL Firebase o percorsi di scrittura.
- Nessuna connessione all'archivio ufficiale.
- Nessun dato reale deve essere inserito in questa demo.

## Limiti noti e prossimo lavoro
1. Suite corrente: 11 test su 11 superati nell'esecuzione automatizzata del codice del laboratorio; resta da eseguire la verifica manuale browser su più dispositivi.
2. Estendere i test con tutte le regole ufficiali e casi reali anonimizzati.
3. Definire un modello esplicito per pause, monte ore, sabatisti, ferie, corsi, festività, competenze per mansione e recuperi.
4. Implementare generazione di più proposte e confronto dei costi/vincoli, con motivazione leggibile.
5. Collegare la UI al motore solo dopo test automatici; integrare i dati soltanto con un livello separato, autorizzato e con conflitti/backup verificabili.
6. Non unire né promuovere finché revisione e test end-to-end non sono superati.
