// Backup COMPLETO del database (pg_dump formato custom, ripristinabile con
// pg_restore) + manifest con conteggi righe e impronta SHA-256.
//
// pg_dump non è installato in locale: usiamo l'immagine Docker ufficiale
// postgres alla stessa versione major del server (pg_dump deve essere >= server).
// La password non passa mai sulla riga di comando: va a Docker tramite un file
// di ambiente temporaneo, cancellato appena finito.
//
// Uso: npx tsx prisma/backup.ts [etichetta]
// Output: backups/<data>_<etichetta>.dump  +  .manifest.json

import { PrismaClient } from "@prisma/client";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const PG_IMAGE = "postgres:17";

if (!process.env.DATABASE_URL) process.loadEnvFile(".env");
const url = new URL(process.env.DATABASE_URL!);

const label = (process.argv[2] ?? "completo").replace(/[^a-z0-9_-]/gi, "_");
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outDir = resolve("backups");
const base = `${stamp}_${label}`;
const dumpPath = join(outDir, `${base}.dump`);

const prisma = new PrismaClient();

/** Conteggio righe di tutte le tabelle applicative + account. */
async function snapshot(): Promise<Record<string, number>> {
  const tables = await prisma.$queryRaw<{ t: string }[]>`
    SELECT table_name AS t FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`;
  const out: Record<string, number> = {};
  for (const { t } of tables) {
    const r = await prisma.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*)::bigint AS n FROM "public"."${t}"`);
    out[`public.${t}`] = Number(r[0].n);
  }
  const u = await prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*)::bigint AS n FROM auth.users`;
  out["auth.users"] = Number(u[0].n);
  return out;
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  const version = (await prisma.$queryRaw<{ v: string }[]>`SELECT version() AS v`)[0].v;
  console.log(`Server: ${version.split(" on ")[0]}`);
  console.log(`Destinazione backup: ${dumpPath}`);

  const before = await snapshot();

  // File d'ambiente temporaneo per libpq (fuori dal progetto, poi cancellato).
  const envFile = join(tmpdir(), `pgenv-${process.pid}-${Date.now()}.env`);
  writeFileSync(
    envFile,
    [
      `PGHOST=${url.hostname}`,
      `PGPORT=${url.port || "5432"}`,
      `PGUSER=${decodeURIComponent(url.username)}`,
      `PGPASSWORD=${decodeURIComponent(url.password)}`,
      `PGDATABASE=${url.pathname.replace(/^\//, "") || "postgres"}`,
      `PGSSLMODE=require`,
    ].join("\n"),
    { mode: 0o600 },
  );

  try {
    console.log(`Esecuzione pg_dump (${PG_IMAGE})…`);
    execFileSync(
      "docker",
      [
        "run", "--rm",
        "--env-file", envFile,
        "-v", `${outDir}:/backup`,
        PG_IMAGE,
        "pg_dump",
        "--format=custom", // compresso, ripristino anche selettivo
        "--no-sync",
        `--file=/backup/${base}.dump`,
      ],
      { stdio: "inherit", env: { ...process.env, MSYS_NO_PATHCONV: "1" } },
    );
  } finally {
    rmSync(envFile, { force: true });
  }

  const after = await snapshot();
  const sha256 = createHash("sha256").update(readFileSync(dumpPath)).digest("hex");
  const stable = JSON.stringify(before) === JSON.stringify(after);

  const manifest = {
    file: `${base}.dump`,
    createdAt: new Date().toISOString(),
    server: version,
    pgDumpImage: PG_IMAGE,
    format: "custom",
    bytes: statSync(dumpPath).size,
    sha256,
    // Se il DB non è cambiato durante il dump, i conteggi del ripristino
    // devono coincidere esattamente con questi.
    stableDuringDump: stable,
    countsBefore: before,
    countsAfter: after,
  };
  writeFileSync(join(outDir, `${base}.manifest.json`), JSON.stringify(manifest, null, 2));

  console.log(`\nBackup creato: ${manifest.bytes.toLocaleString("it-IT")} byte`);
  console.log(`SHA-256: ${sha256}`);
  console.log(`DB stabile durante il dump: ${stable ? "sì" : "NO (attività concorrente)"}`);
  console.log(`Manifest: backups/${base}.manifest.json`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
