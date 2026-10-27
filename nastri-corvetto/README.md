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
La suite attuale contiene **56 test superati su 56**. Sono inclusi controlli su scenari di giornata intera: priorità del piano ordinario rispetto a una deroga emergenziale, blocco della copertura residua insufficiente e generazione coordinata di più fasce nello stesso giorno. Questo è un test del motore in ambiente JavaScript, non sostituisce il collaudo end-to-end nel browser né la verifica con turni reali anonimizzati.

## Interfaccia collegata al validatore
Il pulsante di simulazione dell'anteprima ora chiama `engine.js` e mostra l'esito effettivo del validatore per tre scenari dimostrativi: assenza in magazzino (bloccata per coppia e copertura), competenza ruspa non censita (bloccata) e copertura ufficio del mercoledì (valida secondo le sole regole esplicitamente presenti nel piano demo). Questi risultati verificano il collegamento UI-motore, non la correttezza completa del calendario reale.


## Ricerca combinazioni — ultimo aggiornamento
Il motore applica ora il limite di ricerca anche attraverso entrambi i cicli di espansione delle combinazioni, evitando di continuare a generare candidati oltre il budget previsto. Un test con 30 candidati aggiuntivi verifica il limite osservabile delle combinazioni esplorate. Ultimo controllo automatico: **51/51 test superati**. Questo resta un controllo del motore in JavaScript, non un collaudo completo dell'app nel browser.


## Protezione integrale delle assegnazioni manuali
Il confronto delle proposte confronta ora l'intero record dell'assegnazione manuale con chiavi canoniche, non soltanto persona e orario. Una modifica anche ai metadati (per esempio `countsAsWorkHours`) viene bloccata; è stato aggiunto un test dedicato. Ultimo controllo automatico: **56/56 test superati**.


## Diagnosi strutturata delle lacune
Il motore restituisce ora intervalli di copertura scoperti in forma strutturata, con finestra, giorno, reparto, orario, persone richieste/presenti e deficit numerico. Le finestre di competenza vengono diagnosticate separatamente dal semplice numero di addetti; le deroghe autorizzate restano visibili come coperture ridotte e non vengono fatte passare per coperture ordinarie. Gli scenari emergenziali espongono sia le lacune strutturate sia i messaggi di validazione leggibili. Ultimo controllo automatico: **56/56 test superati**. Le diagnosi sono limitate alle finestre esplicitamente configurate: il motore non inventa orari o fabbisogni mancanti.


## Conteggio affidabile degli addetti
La diagnosi di copertura conta persone distinte, non segmenti di turno. Due assegnazioni sovrapposte attribuite alla stessa persona non possono simulare due addetti presenti. Aggiunto un test dedicato; suite automatica: **57/57 test superati**.

## Priorità delle alternative in revisione
Quando più proposte richiedono revisione, il confronto quantifica il deficit dichiarato di copertura in persone-minuto, separa la componente legata alle competenze e rende visibile la copertura ridotta da deroga. A parità di classe di esito, le alternative con deficit inferiore vengono presentate prima. Questa priorità è un criterio trasparente di confronto, non una garanzia di ottimalità globale né un'autorizzazione automatica. Suite motore: **58/58 test superati**; nessun collaudo end-to-end o con dati reali è implicato.


## Eventi personali e candidati sostitutivi
La ricerca dei candidati esclude ora anche gli intervalli degli eventi personali espliciti del piano (per esempio corso, visita medica, permesso o pausa), senza richiedere che siano duplicati nel campo `unavailable`. Un evento sovrapposto impedisce la raccomandazione; un intervallo adiacente ma non sovrapposto non la impedisce. Suite motore aggiornata: **59/59 test superati**.
