// Genera una NUOVA migrazione versionata dalle modifiche a schema.prisma,
// senza applicarla. Il file SQL va revisionato (e committato) prima di usare
// prisma/deploy-migrations.ts.
//
// Sostituisce "prisma migrate dev", che su un database con drift propone di
// AZZERARLO: qui non si scrive mai sul database, si legge soltanto.
//
// Uso: npm run db:migration:new -- nome_modifica

import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const name = (process.argv[2] ?? "").trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
if (!name) {
  console.error("Indica un nome: npm run db:migration:new -- aggiunge_campo_x");
  process.exit(1);
}

const prisma = (args: string[]) =>
  spawnSync("npx", ["prisma", ...args], { encoding: "utf8", shell: process.platform === "win32" });

// 1) Il database deve essere allineato alla cronologia delle migrazioni,
//    altrimenti la differenza includerebbe migrazioni già scritte ma non applicate.
const status = prisma(["migrate", "status"]);
const statusOut = `${status.stdout}\n${status.stderr}`;
if (!/Database schema is up to date/i.test(statusOut)) {
  console.error("Il database non è allineato alle migrazioni esistenti:\n");
  console.error(statusOut.split("\n").filter((l) => l.trim() && !/npm notice|prisma-config|deprecated/i.test(l)).join("\n"));
  console.error("\nApplica (o registra) prima le migrazioni in attesa: npm run db:migrate:deploy");
  process.exit(1);
}

// 2) SQL necessario per portare il database a schema.prisma (sola lettura).
const sql = execFileSync(
  "npx",
  ["prisma", "migrate", "diff", "--from-schema-datasource", "prisma/schema.prisma",
    "--to-schema-datamodel", "prisma/schema.prisma", "--script"],
  { encoding: "utf8", shell: process.platform === "win32" },
).trim();

if (!sql || /^-- This is an empty migration/i.test(sql)) {
  console.log("Nessuna differenza tra schema.prisma e database: nessuna migrazione da creare.");
  process.exit(0);
}

// 3) Scrive la migrazione (NON la applica).
const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14); // AAAAMMGGhhmmss
const dir = join("prisma", "migrations", `${stamp}_${name}`);
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, "migration.sql"), sql + "\n");

// 4) Evidenzia le istruzioni che possono perdere dati.
const risky = sql.split("\n").filter((l) =>
  /^\s*(DROP\s|DELETE\s|TRUNCATE\s|ALTER\s+TABLE.*\s(DROP|ALTER\s+COLUMN.*TYPE)\s)/i.test(l),
);

console.log(`Migrazione creata (NON applicata): ${dir}/migration.sql\n`);
if (risky.length) {
  console.log("ATTENZIONE — istruzioni potenzialmente DISTRUTTIVE da valutare con cura:");
  for (const l of risky) console.log(`  ${l.trim()}`);
  console.log("");
}
console.log("Prossimi passi:\n  1. revisiona il file SQL\n  2. committalo\n  3. npm run db:migrate:deploy  (mostra di nuovo l'SQL e chiede conferma)");
