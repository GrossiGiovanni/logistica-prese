# Database — Modelli e relazioni

ORM: **Prisma** · DB: **PostgreSQL** (locale o Supabase via `DATABASE_URL`).
Schema completo in [`prisma/schema.prisma`](../prisma/schema.prisma).

## Modelli principali

### Customer (cliente)
Anagrafica cliente. Ha molti `Address`, molte `Pickup`, molte `RecurringPickup`.

### Address (indirizzo)
Indirizzo di ritiro. Appartiene a un `Customer`. Un cliente può avere più
indirizzi (es. Sede principale, Magazzino, Produzione). Nessun geocoding.

### Driver (autista)
Anagrafica autista. Può avere un `defaultVehicle` (mezzo predefinito). `active`
per il soft-delete. `company` = EUROSARDA | RAMA | OMAR | ALTRO decide la voce di
costo dei suoi giri (Industriale ritiri / Rama Trasporti / Omar Trasporti /
non classificato). `isEurosarda` è derivato da `company` e non va usato nei calcoli.

### Vehicle (mezzo)
Parco mezzi. `vehicleType` = VAN | TRUCK | MOTRICE. `costLevel` = LOW | MEDIUM |
HIGH. Le **MOTRICE** hanno costo alto e sono evidenziate nella UI. `active` per
il soft-delete. `capacityPallets` usato per il warning di capacità superata.

### Pickup (presa)
La presa/ritiro di un giorno. Appartiene a `Customer` e `Address`. `sourceType` =
SPOT | RECURRING. `status` = DRAFT | READY | PLANNED | CANCELLED. Può essere
collegata opzionalmente a una `RecurringPickup` (campo `recurringPickupId`) per
tracciare la generazione automatica ed evitare duplicati.

**Anti-duplicato:** vincolo unico `@@unique([pickupDate, recurringPickupId])`.
Poiché in PostgreSQL i NULL sono considerati distinti, le prese spot
(`recurringPickupId = null`) non sono soggette al vincolo.

### RecurringPickup (presa fissa)
Ricorrenza che genera prese. Ha i flag dei giorni della settimana
(`monday`…`sunday`) e i valori `default*` copiati nelle prese generate.

### Route (giro)
Giro di una data. `shift` = MORNING | AFTERNOON | FULL_DAY. `status` = DRAFT |
CONFIRMED. Opzionalmente collegato a `Driver` e `Vehicle`. Ha molti `RouteStop`.

### RouteStop (fermata)
Collega una `Route` a una `Pickup` con un `sequence` (ordine manuale).
Vincolo unico `@@unique([routeId, pickupId])`.

## Relazioni (sintesi)

- Customer 1—N Address
- Customer 1—N Pickup, Address 1—N Pickup
- RecurringPickup N—1 Customer, N—1 Address
- Pickup N—1 RecurringPickup (opzionale)
- Route 1—N RouteStop, RouteStop N—1 Pickup
- Route N—1 Driver (opzionale), Route N—1 Vehicle (opzionale)
- Driver N—1 Vehicle predefinito (opzionale)

## Enum

`VehicleType`, `CostLevel`, `PickupSourceType`, `PickupStatus`, `TimeWindow`,
`Priority`, `RouteShift`, `RouteStatus`.

## Logica di stato delle prese

- Generazione fissa: `READY` se i dati minimi (pallet) sono presenti, altrimenti `DRAFT`.
- Assegnazione a un giro: la presa passa a `PLANNED`.
- Rimozione da un giro (se non in altri giri): torna a `READY` o `DRAFT` in base ai dati.
- Annullamento: `CANCELLED` (soft) e rimozione da eventuali giri.

## Report mensile (consuntivo e forecast)

Calcoli in [`src/features/reports/monthly-calc.ts`](../src/features/reports/monthly-calc.ts),
test in `monthly-calc.test.ts` (`npm test`).

- **Oggi** = giorno di calendario a Roma (`Europe/Rome`).
- **Consuntivo**: solo date fino a oggi e solo giri `CONFIRMED`; i giri in bozza
  sono mostrati a parte.
- **Prese effettuate**: prese distinte nei giri confermati del periodo, anche se
  con data presa precedente (arretrate).
- **Costo raccolta** = Rama + Omar + Industriale ritiri. Trazioni e noli sono
  voci separate; giri senza autista o con azienda «Altro» → «non classificato».
- **Forecast**: registrato + per ogni giorno lavorativo rimanente il pianificato
  (giri confermati, trazioni, noli già registrati) oppure la media per giorno
  lavorativo trascorso: mai entrambi.

## Dati mancanti

Una presa è "con dati mancanti" se: manca `pallets`, oppure manca `addressId`,
oppure manca `timeWindow`, oppure ha note vuote e nessun dato operativo utile.
Logica centralizzata in [`src/lib/warnings.ts`](../src/lib/warnings.ts).
