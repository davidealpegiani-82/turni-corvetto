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
Rendere il motore capace di confrontare scenari di giornata intera (piano ordinario, piano ridotto con deroghe esplicite, migliore copertura possibile con lacune dichiarate), quindi collegare la UI ai risultati reali del motore e aggiungere test end-to-end prima di qualunque rilascio.

## Ultimo controllo automatico
La suite attuale contiene **48 test superati su 48**. Sono inclusi controlli su scenari di giornata intera: priorità del piano ordinario rispetto a una deroga emergenziale, blocco della copertura residua insufficiente e generazione coordinata di più fasce nello stesso giorno. Questo è un test del motore in ambiente JavaScript, non sostituisce il collaudo end-to-end nel browser né la verifica con turni reali anonimizzati.

## Interfaccia collegata al validatore
Il pulsante di simulazione dell'anteprima ora chiama `engine.js` e mostra l'esito effettivo del validatore per tre scenari dimostrativi: assenza in magazzino (bloccata per coppia e copertura), competenza ruspa non censita (bloccata) e copertura ufficio del mercoledì (valida secondo le sole regole esplicitamente presenti nel piano demo). Questi risultati verificano il collegamento UI-motore, non la correttezza completa del calendario reale.
