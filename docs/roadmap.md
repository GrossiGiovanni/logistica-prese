# Roadmap

## Fase attuale — MVP operativo

Obiettivo: software **semplice, operativo, stabile e comprensibile** per la
pianificazione giornaliera delle prese. Include anagrafiche, prese spot e fisse,
generazione automatica, giri con assegnazioni e riordino, pianificazione,
dashboard KPI e warning. Niente mappe, routing o integrazioni esterne.

### Limiti noti del MVP
- Nessuna autenticazione (app interna).
- I campi opzionali svuotati in modifica non vengono azzerati (Prisma `undefined`
  = "non modificare"). Da rivedere se necessario.
- Assegnazione prese senza drag&drop (select + bottone).

## Prossime evoluzioni (fuori scope ora)

1. **Mappa e geocoding** degli indirizzi di ritiro.
2. **Calcolo km e ottimizzazione percorsi** (ordinamento automatico delle fermate).
3. **Portale autista** con vista del proprio giro e aggiornamento stato prese.
4. **Notifiche** (es. WhatsApp/email) verso clienti e autisti.
5. **App mobile** per gli operatori in deposito.
6. **Integrazione AS400** per sincronizzare le prese.
7. **Suggerimenti automatici** di assegnazione mezzo/giro in base a capacità,
   requisiti (motrice/sponda) e priorità.
8. Drag & drop nella pianificazione.
9. Autenticazione e ruoli.
