// Applica le migrazioni versionate in attesa, DOPO revisione.
//
//  - mostra il database di destinazione e l'SQL di ogni migrazione in attesa;
//  - senza --yes è solo una revisione: non applica nulla;
//  - se una migrazione contiene istruzioni potenzialmente distruttive, richiede
//    anche --backup <file.dump> con un backup VERIFICATO (prisma/verify-backup.ts);
//  - usa "prisma migrate deploy", che non azzera mai il database.
//
// Uso:
//   npm run db:migrate:deploy                         (revisione)
//   npm run db:migrate:deploy -- --yes                (applica)
//   npm run db:migrate:deploy -- --yes --backup backups/<file>.dump

import { PrismaClient } from "@prisma/client";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const YES = args.includes("--yes");
const backupIdx = args.indexOf("--backup");
const BACKUP = backupIdx >= 0 ? args[backupIdx + 1] : undefined;

const RISKY = /^\s*(DROP\s|DELETE\s|TRUNCATE\s|ALTER\s+TABLE.*\s(DROP|ALTER\s+COLUMN.*TYPE)\s)/i;
const MIGRATIONS = join("prisma", "migrations");

const prisma = new PrismaClient();

async function main() {
  if (!process.env.DATABASE_URL) process.loadEnvFile(".env");
  const u = new URL(process.env.DATABASE_URL!);
  console.log(`Database di destinazione: ${decodeURIComponent(u.username)}@${u.hostname}${u.pathname}\n`);

  // La cronologia deve esistere: altrimenti va prima registrata la baseline.
  const hasTable = (await prisma.$queryRaw<{ ok: boolean }[]>`
    SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS ok`)[0].ok;
  if (!hasTable) {
    console.error("La cronologia migrazioni non è ancora registrata su questo database.");
    console.error("Registra la baseline (non esegue SQL, la segna solo come già applicata):");
    console.error("  npx prisma migrate resolve --applied 0_init");
    process.exit(1);
  }

  const applied = new Set(
    (await prisma.$queryRaw<{ migration_name: string }[]>`
      SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`)
      .map((r) => r.migration_name),
  );
  const local = readdirSync(MIGRATIONS, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  const pending = local.filter((m) => !applied.has(m));

  if (pending.length === 0) {
    console.log("Nessuna migrazione in attesa: il database è aggiornato.");
    return;
  }

  let risky = false;
  for (const m of pending) {
    const sql = readFileSync(join(MIGRATIONS, m, "migration.sql"), "utf8");
    const bad = sql.split("\n").filter((l) => RISKY.test(l));
    risky ||= bad.length > 0;
    console.log(`=== ${m} ===\n${sql.trim()}\n`);
    if (bad.length) {
      console.log("  !! istruzioni potenzialmente DISTRUTTIVE:");
      bad.forEach((l) => console.log(`     ${l.trim()}`));
      console.log("");
    }
  }

  if (!YES) {
    console.log(`REVISIONE: ${pending.length} migrazione/i in attesa, nessuna applicata.`);
    console.log(`Per applicare: npm run db:migrate:deploy -- --yes${risky ? " --backup backups/<file>.dump" : ""}`);
    return;
  }

  if (risky) {
    if (!BACKUP) {
      console.error("Migrazioni potenzialmente distruttive: serve --backup <file.dump> con backup verificato.");
      process.exit(1);
    }
    const verify = BACKUP.replace(/\.dump$/, ".verify.json");
    if (!existsSync(verify) || !JSON.parse(readFileSync(verify, "utf8")).passed) {
      console.error(`Backup non verificato: esegui prima  npx tsx prisma/verify-backup.ts ${BACKUP}`);
      process.exit(1);
    }
    console.log(`Backup verificato: ${BACKUP}`);
  }

  await prisma.$disconnect();
  execFileSync("npx", ["prisma", "migrate", "deploy"], { stdio: "inherit", shell: process.platform === "win32" });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
