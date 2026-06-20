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

- **Node.js 18.18+** (consigliato 20+)
- Un database **PostgreSQL**: in locale, oppure **Supabase**.

## Setup

### 1. Variabili d'ambiente

Copia il file di esempio e imposta la stringa di connessione:

```bash
cp .env.example .env
```

- **Locale:**
  ```
  DATABASE_URL="postgresql://postgres:postgres@localhost:5432/logistica_prese?schema=public"
  ```
- **Supabase:** Project Settings → Database → Connection string (URI). Vedi i
  commenti in `.env.example` per pooling (6543) e connessione diretta (5432).

### 2. Installazione

```bash
npm install
```

### 3. Database (migrazioni + client Prisma)

```bash
npm run db:migrate     # crea le tabelle (prisma migrate dev)
# in alternativa, senza file di migrazione: npm run db:push
```

### 4. Dati demo (seed)

```bash
npm run db:seed
```

Crea 10 clienti (località lombarde), 13 mezzi (di cui 2 motrici), 5 autisti,
prese spot per domani, prese fisse attive e 2 giri demo.

### 5. Avvio in sviluppo

```bash
npm run dev
# → http://localhost:3000  (reindirizza a /dashboard)
```

## Comandi npm

| Comando | Descrizione |
|---|---|
| `npm run dev` | Avvia il server di sviluppo |
| `npm run build` | `prisma generate` + build di produzione |
| `npm run start` | Avvia il build di produzione |
| `npm run db:migrate` | Crea/applica le migrazioni (`prisma migrate dev`) |
| `npm run db:deploy` | Applica le migrazioni in produzione (`prisma migrate deploy`) |
| `npm run db:push` | Sincronizza lo schema senza migrazioni |
| `npm run db:seed` | Inserisce i dati demo |
| `npm run db:generate` | Genera il Prisma Client |
| `npm run db:studio` | Apre Prisma Studio |

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
  mezzo/autista mancante, ecc.).

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
prisma/           # schema.prisma + seed.ts
docs/             # requisiti, database, roadmap
```

Documentazione di dettaglio in [`docs/`](docs/).
