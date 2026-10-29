# Corvetto Engine (Fase C)

## File
- `engine.js` — `OFFICIAL_POLICY` + facciata `window.CorvettoEngine`
- `index.html` — implementazione generazione/apply/UI; registra le funzioni su `CorvettoEngine.register(...)`

## API pubblica
```js
CorvettoEngine.policy
CorvettoEngine.generate(options?)
CorvettoEngine.finalize(week, notes, weekKey)
CorvettoEngine.verifyGaps(week)
CorvettoEngine.hardViolations(proposal)
CorvettoEngine.apply(options?)
CorvettoEngine.runSelfTests() // → report in window.__engineTestReport
```

## Criterio di non regressione
Al load, in console:
- `OFFICIAL_POLICY OK`
- `CorvettoEngine self-tests OK`
Se FAIL, non pubblicare la settimana finché i fails non sono risolti.
