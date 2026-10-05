// Guardia per gli script DISTRUTTIVI (seed, reset, import "pulito").
//
// Va chiamata PRIMA di qualsiasi deleteMany/reset. Regole, in ordine:
//   1. PRODUZIONE  → sempre rifiutato, nessuna eccezione possibile.
//   2. LOCALE      → consentito (localhost / 127.0.0.1 / ::1 / host.docker.internal).
//   3. TEST remoto → consentito SOLO con autorizzazione esplicita: la variabile
//      SEED_ALLOW_REMOTE_HOST deve contenere esattamente l'host di destinazione
//      (doppia conferma: bisogna sapere e scrivere su quale DB si sta operando).
//   Tutto il resto → rifiutato.
//
// Non serve una conferma interattiva: l'unica via per colpire un DB remoto è
// dichiararne l'host per esteso, e la produzione resta comunque esclusa.

/**
 * Impronte del database di produzione. Un DB che le contiene NON può mai essere
 * svuotato da questi script. Il riferimento del progetto Supabase compare
 * nell'utente della connessione (es. "postgres.<ref>@...pooler.supabase.com").
 */
const PRODUCTION_FINGERPRINTS = ["hkiobcacccizjjndoxkk"];

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "host.docker.internal"]);

export class UnsafeDatabaseError extends Error {}

type Target = { host: string; database: string; user: string };

function parseTarget(url: string): Target {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new UnsafeDatabaseError("DATABASE_URL non valida: impossibile determinare il database di destinazione.");
  }
  return {
    host: u.hostname.toLowerCase(),
    database: u.pathname.replace(/^\//, "") || "(predefinito)",
    user: decodeURIComponent(u.username),
  };
}

/**
 * Verifica che sia sicuro svuotare/ricreare il database indicato da DATABASE_URL.
 * Lancia UnsafeDatabaseError (e lo script si ferma) se non lo è.
 */
export function assertSafeToWipe(scriptName: string): Target {
  // Se lanciato con tsx diretto, .env potrebbe non essere caricato: lo carichiamo
  // così la guardia valuta ESATTAMENTE lo stesso database che userà Prisma
  // (Prisma dà precedenza alle variabili già presenti in process.env).
  if (!process.env.DATABASE_URL) {
    try {
      process.loadEnvFile(".env");
    } catch {
      // nessun .env: resta non impostata e la guardia rifiuta qui sotto
    }
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new UnsafeDatabaseError("DATABASE_URL non impostata.");

  const t = parseTarget(url);
  const where = `${t.user}@${t.host}/${t.database}`;

  // 1) Produzione: rifiuto incondizionato.
  const isProdFingerprint = PRODUCTION_FINGERPRINTS.some(
    (fp) => url.includes(fp) || t.user.includes(fp) || t.host.includes(fp),
  );
  const isProdRuntime = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
  if (isProdFingerprint || isProdRuntime) {
    throw new UnsafeDatabaseError(
      `[${scriptName}] RIFIUTATO: il database di destinazione è la PRODUZIONE (${where}).\n` +
        `Questo script cancella i dati e non può mai girare in produzione.\n` +
        `Usa un database locale (vedi README, sezione "Database di sviluppo").`,
    );
  }

  // 2) Locale: consentito.
  if (LOCAL_HOSTS.has(t.host)) {
    console.log(`[${scriptName}] Database LOCALE: ${where} — ok.`);
    return t;
  }

  // 3) Remoto di test: solo con autorizzazione esplicita sull'host esatto.
  const allowed = (process.env.SEED_ALLOW_REMOTE_HOST ?? "").trim().toLowerCase();
  if (allowed && allowed === t.host) {
    console.log(`[${scriptName}] Database REMOTO autorizzato esplicitamente: ${where}.`);
    return t;
  }

  throw new UnsafeDatabaseError(
    `[${scriptName}] RIFIUTATO: database remoto non autorizzato (${where}).\n` +
      `Per un database di TEST remoto imposta SEED_ALLOW_REMOTE_HOST=${t.host}\n` +
      `(deve coincidere esattamente con l'host). La produzione non è mai ammessa.`,
  );
}

/** Esegue la guardia e termina il processo con messaggio chiaro se fallisce. */
export function guardOrExit(scriptName: string): Target {
  try {
    return assertSafeToWipe(scriptName);
  } catch (e) {
    if (e instanceof UnsafeDatabaseError) {
      console.error("\n" + e.message + "\n");
      process.exit(1);
    }
    throw e;
  }
}
