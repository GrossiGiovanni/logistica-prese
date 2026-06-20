# Requisiti — MVP Pianificazione Prese

## Problema

L'organizzazione giornaliera delle prese/ritiri logistici (~40 al giorno) è oggi
manuale: richieste via mail o telefono, prese stampate, giri organizzati su carta,
assegnazione di prese/autisti/mezzi basata sull'esperienza. I dati sono spesso
incompleti (manca peso, volume, orario, ecc.) e molte informazioni stanno in note
libere. Questo genera carta, errori e forte dipendenza dalle persone.

## Obiettivo del MVP

Una dashboard web interna e operativa per:

- inserire e gestire **prese spot**;
- gestire **prese fisse/ricorrenti** e generarle automaticamente per una data;
- vedere la **lista delle prese del giorno** ed evidenziare quelle con **dati mancanti**;
- creare **giri** manualmente e assegnare prese, autista e mezzo;
- distinguere giri **mattina / pomeriggio / giornata intera**;
- vedere **KPI operativi** giornalieri;
- ridurre carta, errori e dipendenza dall'esperienza.

## Funzionalità incluse

- Anagrafiche: clienti, indirizzi (più indirizzi per cliente), autisti, mezzi.
- Mezzi con tipo (VAN/TRUCK/MOTRICE), capacità pallet, sponda, livello costo.
  Le **motrici** (costo alto) sono evidenziate.
- Prese spot con stato, fascia oraria, quantità, requisiti e note.
- Prese fisse con giorni della settimana e valori predefiniti.
- Generazione prese fisse per data (idempotente, anti-duplicato).
- Giri con fermate ordinabili (su/giù), assegnazione/rimozione prese.
- Pagina **Pianificazione** come schermata operativa principale.
- Dashboard con KPI giornalieri.
- Regole di **warning** su prese e giri (dati mancanti, capacità superata,
  uso motrice, mezzo/autista mancante, ecc.).

## Funzionalità escluse (fuori scope in questa fase)

- Mappe, geocoding, calcolo km, ottimizzazione percorsi.
- Portale autista, interazione con autisti, WhatsApp, app mobile.
- Integrazione AS400.
- AI / algoritmi avanzati di routing.
- Autenticazione utenti (app interna).

## Criteri di accettazione

L'operatore può: avviare il progetto localmente; vedere la dashboard; creare
clienti, indirizzi, mezzi, autisti; creare prese spot e fisse; generare le prese
fisse per domani; vedere tutte le prese del giorno e quelle con dati mancanti;
creare un giro, assegnare autista e mezzo, assegnare/rimuovere prese, riordinare
le fermate; vedere i warning (motrice usata, capacità superata); vedere i KPI;
usare `/pianificazione` come schermata operativa principale.
