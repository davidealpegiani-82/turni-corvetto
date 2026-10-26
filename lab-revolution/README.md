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
- eventi tipizzati (ferie, ROL, permessi, donazione sangue, corso, visita medica, pausa e recupero), conflitti turno-evento e richiesta di segmentare il turno;
- riepilogo ore prudenziale (`summarizeHours`): conta soltanto segmenti con `countsAsWorkHours` esplicito, lascia incompleti i dati mancanti e annulla il totale affidabile in presenza di sovrapposizioni;
- gruppo ufficio ammesso il mercoledì;
- finestre di apertura e chiusura per ruolo verificabili in tutti i giorni configurati; il gruppo ammesso dell'ufficio del mercoledì resta un vincolo separato;
- generatore limitato e deterministico (`generateProposals`) per slot espliciti: valuta candidati solo con competenze/disponibilità note, combina alternative senza sovrapposizioni e produce piani da verificare; non scrive né applica turni;
- confronto delle proposte (`compareProposals`), con classificazione deterministica e blocco delle assegnazioni manuali protette se modificate o rimosse;
- coppie magazzino dichiarate come obbligatorie;
- copertura minima su finestre temporali; le deroghe emergenziali sono esplicite, motivate e autorizzate, possono scendere sotto la soglia ordinaria soltanto fino al minimo operativo configurato e non possono autorizzare copertura zero;
- copertura per competenza (`skillCoverageWindows`), così una presenza numerica non basta se manca la qualifica richiesta;
- soglia di apertura magazzino quando sono disponibili almeno tre persone (`warehouseOpeningRules`);
- coppie preferenziali che, se separate, generano un avviso di revisione (`preferredPairs`), senza confonderle con le coppie obbligatorie;
- candidati sostitutivi soltanto quando disponibilità e skill sono note, senza applicarli automaticamente.

## Contratto di sicurezza
- Dati mancanti o sconosciuti non sono considerati validi.
- Un candidato è un suggerimento da riesaminare, mai un turno già applicato.
- Il motore non contiene credenziali, URL Firebase o percorsi di scrittura.
- Nessuna connessione all'archivio ufficiale.
- Nessun dato reale deve essere inserito in questa demo.

## Limiti noti e prossimo lavoro
1. Suite automatizzata del motore: 44 test su 44 superati nell'ultima esecuzione del laboratorio; resta da eseguire la verifica manuale browser su più dispositivi.
2. Estendere i test con tutte le regole ufficiali e casi reali anonimizzati.
3. Completare l'integrazione del riepilogo ore con regole configurabili per pause, eventi retribuiti/non retribuiti, sabatisti e recuperi; il riepilogo prudenziale esiste, ma non deduce automaticamente le regole contrattuali.
4. Estendere il generatore limitato verso una ricerca multi-slot più completa, con costi/preferenze configurabili, motivazioni leggibili e casi reali anonimizzati. La generazione attuale è sperimentale: ordina per validità, avvisi, coppie preferenziali, uso del jolly esplicitamente censito e stabilità delle assegnazioni, ma non garantisce ottimalità globale.
5. Collegare la UI al motore solo dopo test automatici; integrare i dati soltanto con un livello separato, autorizzato e con conflitti/backup verificabili.
6. Non unire né promuovere finché revisione e test end-to-end non sono superati.
