# Nastri Corvetto — app indipendente in sviluppo

Nastri Corvetto nasce come applicazione distinta da Turni Corvetto. Questa cartella è una base di sviluppo isolata: non modifica l'app ufficiale, non legge né scrive il database Firebase e non applica turni reali.

## Aprire l'anteprima
Apri `index.html` in un browser moderno. La schermata usa dati dimostrativi e interazioni locali.

## Verificare il motore
Apri `engine-tests.html` in un browser moderno. La pagina esegue i test di `engine.js` e mostra il risultato. I test del motore sono separati dalla demo grafica.

## File principali
- `index.html`: prima interfaccia e flussi dimostrativi.
- `engine.js`: validatore deterministico sperimentale; non è ancora un generatore completo di turni.
- `engine-tests.html`: test ripetibili del motore.
- `rulebook.json`: regole operative in bozza da validare.
- `plan-schema.example.json`: contratto dati esemplificativo.

## Stato e limiti
- Progetto separato a livello di cartella e ramo Git.
- Nessuna connessione ai dati ufficiali.
- Nessuna pubblicazione operativa o sostituzione di Turni Corvetto in questa fase.
- I dati mostrati dall'interfaccia sono dimostrativi.
- Una deroga emergenziale produce un esito da revisionare, non un'approvazione automatica.
- Il motore deve ancora essere esteso e collaudato su giornate complete, casi normali, assenze multiple, coppie di magazzino e coperture minime.

## Prossima fase
Estendere la ricerca coordinata su giornate intere con diagnosi delle lacune per fascia e competenza; rendere la UI capace di confrontare scenari emergenziali usando dati reali configurabili; aggiungere test end-to-end e prove con turni reali anonimizzati prima di qualunque rilascio.

## Ultimo controllo automatico
La suite attuale contiene **52 test superati su 52**. Sono inclusi controlli su scenari di giornata intera: priorità del piano ordinario rispetto a una deroga emergenziale, blocco della copertura residua insufficiente e generazione coordinata di più fasce nello stesso giorno. Questo è un test del motore in ambiente JavaScript, non sostituisce il collaudo end-to-end nel browser né la verifica con turni reali anonimizzati.

## Interfaccia collegata al validatore
Il pulsante di simulazione dell'anteprima ora chiama `engine.js` e mostra l'esito effettivo del validatore per tre scenari dimostrativi: assenza in magazzino (bloccata per coppia e copertura), competenza ruspa non censita (bloccata) e copertura ufficio del mercoledì (valida secondo le sole regole esplicitamente presenti nel piano demo). Questi risultati verificano il collegamento UI-motore, non la correttezza completa del calendario reale.


## Ricerca combinazioni — ultimo aggiornamento
Il motore applica ora il limite di ricerca anche attraverso entrambi i cicli di espansione delle combinazioni, evitando di continuare a generare candidati oltre il budget previsto. Un test con 30 candidati aggiuntivi verifica il limite osservabile delle combinazioni esplorate. Ultimo controllo automatico: **51/51 test superati**. Questo resta un controllo del motore in JavaScript, non un collaudo completo dell'app nel browser.


## Protezione integrale delle assegnazioni manuali
Il confronto delle proposte confronta ora l'intero record dell'assegnazione manuale con chiavi canoniche, non soltanto persona e orario. Una modifica anche ai metadati (per esempio `countsAsWorkHours`) viene bloccata; è stato aggiunto un test dedicato. Ultimo controllo automatico: **52/52 test superati**.
