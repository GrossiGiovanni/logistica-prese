# Logistica Prese — MVP pianificazione ritiri

Dashboard web interna e operativa per la pianificazione giornaliera delle
prese/ritiri logistici: prese spot e fisse, generazione automatica delle
ricorrenze, creazione giri con assegnazione di prese/autisti/mezzi, KPI e warning
operativi. Interfaccia in italiano.

> Questo è un progetto **separato** rispetto all'app "EPAL bancali" presente nella
> cartella padre. Vive interamente in `logistica-prese/`.

## Stack

- **Next.js 15** (App Router) + **React 19**
- **TypeScript**
- **PostgreSQL** + **Prisma ORM**
- **Tailwind CSS**
- **Zod** per la validazione di form e server action
- Mutazioni via **Server Actions**

## Prerequisiti

- **Node.js 20+**
- Accesso al database PostgreSQL (in produzione: **Supabase**)
- **Docker** — solo per backup, verifiche e per un eventuale database di sviluppo locale

## Avvio del progetto

Il database di produzione esiste già e contiene **dati reali**: l'avvio del
progetto **non** prevede la creazione di tabelle né il caricamento di dati demo.

### 1. Variabili d'ambiente

```bash
cp .env.example .env
```

Imposta `DATABASE_URL` (Supabase → Project Settings → Database → Connection
string), le chiavi Supabase (`NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`) e le chiavi Google Maps.

### 2. Installazione e client Prisma

```bash
npm install
npm run db:generate
```

### 3. Avvio in sviluppo

```bash
npm run dev
# → http://localhost:3000
```

## Database: regole di sicurezza

> ⚠️ Il `DATABASE_URL` del file `.env` punta alla **produzione**. Ogni comando
> che modifica il database agisce sui dati reali.

Prima di qualsiasi cancellazione o migrazione sul database reale:
**verifica il backup, l'ambiente di destinazione e l'SQL generato.**
Le operazioni distruttive non vanno mai applicate senza controllo.

### Modifiche allo schema: solo migrazioni versionate

Lo schema è gestito con migrazioni Prisma in `prisma/migrations` (la baseline
`0_init` fotografa lo schema di produzione). Ogni modifica genera un file SQL
da revisionare prima dell'applicazione:

1. modifica `prisma/schema.prisma`;
2. `npm run db:migration:new -- descrizione_modifica` — crea
   `prisma/migrations/<data>_<nome>/migration.sql` **senza applicarlo** e
   segnala le istruzioni potenzialmente distruttive;
3. revisiona l'SQL e committalo;
4. `npm run db:migrate:deploy` — **revisione**: mostra destinazione e SQL in attesa;
5. `npm run db:migrate:deploy -- --yes` — applica. Se la migrazione può perdere
   dati richiede anche `--backup backups/<file>.dump` con un backup verificato.

**Da non usare sul database di produzione:** `prisma db push`,
`prisma migrate dev`, `prisma migrate reset` — possono cancellare dati o
applicare modifiche senza un file di migrazione revisionabile.

### Backup

```bash
npm run db:backup -- etichetta                       # backup completo (pg_dump via Docker)
npm run db:backup:verify -- backups/<file>.dump      # verifica con ripristino reale
```

La verifica ripristina il backup in un Postgres temporaneo e confronta i
conteggi tabella per tabella. I file finiscono in `backups/`, **escluso da git**:
contengono dati reali e gli hash delle password.

### Seed e dati demo: SOLO sviluppo/test

`npm run db:seed` **svuota le tabelle** e le riempie con dati fittizi. Serve
esclusivamente per sviluppo e test e **non deve mai essere eseguito in
produzione**. Per sicurezza (`prisma/guard.ts`) il seed:

- **rifiuta sempre** il database di produzione, senza eccezioni;
- parte automaticamente solo su un database **locale** (`localhost`);
- su un database di test **remoto** parte solo se `SEED_ALLOW_REMOTE_HOST`
  contiene esattamente l'host di destinazione.

La stessa protezione è applicata a `prisma/import-cliente.ts` (reset completo).

Database di sviluppo locale con Docker:

```bash
docker run -d --name logistica-dev -e POSTGRES_PASSWORD=dev -p 5433:5432 postgres:17
export DATABASE_URL="postgresql://postgres:dev@localhost:5433/postgres"
npx prisma migrate deploy   # crea le tabelle dalla cronologia delle migrazioni
npm run db:seed             # dati demo, solo su questo database locale
```

Su PowerShell usa `$env:DATABASE_URL = "postgresql://..."` al posto di `export`.

## Comandi npm

| Comando | Descrizione |
|---|---|
| `npm run dev` | Avvia il server di sviluppo |
| `npm run build` | `prisma generate` + build di produzione |
| `npm run start` | Avvia il build di produzione |
| `npm run db:generate` | Genera il Prisma Client |
| `npm run db:migration:new -- <nome>` | Crea una migrazione da revisionare (non la applica) |
| `npm run db:migrate:status` | Stato delle migrazioni sul database |
| `npm run db:migrate:deploy` | Revisiona e (con `--yes`) applica le migrazioni in attesa |
| `npm run db:backup` | Backup completo del database |
| `npm run db:backup:verify` | Verifica un backup con ripristino reale |
| `npm run db:studio` | Apre Prisma Studio |
| `npm run db:seed` | **Solo sviluppo/test** — dati demo su DB locale (rifiuta la produzione) |
| `npm test` | Test automatici della logica (costi, report, date, import AS400, stati, warning) |

## Funzionalità implementate

- **Anagrafiche** CRUD: clienti, indirizzi, autisti, mezzi (motrici evidenziate).
- **Prese spot** con filtri (data, stato, origine, fascia, ricerca), badge stato e
  badge "dati mancanti".
- **Prese fisse** con giorni della settimana e valori predefiniti.
- **Generazione prese fisse** per data, idempotente e anti-duplicato.
- **Giri**: creazione, assegnazione autista/mezzo, fascia, assegna/rimuovi prese,
  riordino fermate (su/giù), conferma giro.
- **Pianificazione** (`/pianificazione`): schermata operativa con prese non
  assegnate, giri del giorno, KPI e assegnazione rapida.
- **Dashboard** (`/dashboard`): KPI giornalieri e liste sintetiche.
- **Warning** su prese e giri (dati mancanti, capacità superata, motrice usata,
  mezzo/autista mancante, autista/mezzo già impegnati, ecc.): un'unica funzione
  `getRouteWarnings` usata ovunque.
- **Carichi** (`/carichi`): unica fonte delle trazioni. Un carico fatto da un
  autista Eurosarda (o con vettore marcato «Vettore Eurosarda» in Anagrafica →
  Trazionisti) è una trazione industriale: il nolo va nel **Costo Industriale**.
  Gli altri carichi sono noli esterni. La vecchia sezione «Trazioni» è stata
  rimossa (tabella `Traction` conservata solo come archivio).
- **Costi** (Home, Pianificazione, Report mensile, export «Costi e km»): Rama,
  Omar, Costo Industriale (ritiri Eurosarda + trazioni Eurosarda), noli esterni,
  non classificato; le voci sommano sempre il costo totale. Dettagli in
  [`docs/database.md`](docs/database.md).
- **Pianificazione Fabio**: archiviata (non raggiungibile, fuori dal menu). Il
  codice è conservato in `src/features/plan-fabio/`; per riattivarla vedi il
  commento in testa a `PianificazioneFabioPage.tsx`.

## Funzionalità escluse (fase MVP)

Mappe, geocoding, calcolo km, ottimizzazione percorsi, portale autista,
interazione con autisti, WhatsApp, app mobile, integrazione AS400, AI/routing
avanzato, autenticazione. Vedi [`docs/roadmap.md`](docs/roadmap.md).

## Struttura

```
src/
  app/            # pagine (App Router) — dashboard, pianificazione, prese, giri, anagrafiche
  components/     # UI riutilizzabile (layout, ui, forms, tables, badges)
  features/       # logica per dominio (queries + server actions + form)
  lib/            # db, dates, labels, warnings, validations
prisma/           # schema.prisma, migrations/, script operativi (backup, guard, seed)
docs/             # requisiti, database, roadmap
```

Documentazione di dettaglio in [`docs/`](docs/).
