// Verifica di integrità di un backup creato da prisma/backup.ts.
//
// Controlli (tutti devono passare):
//   1. l'impronta SHA-256 del file coincide con quella del manifest;
//   2. l'archivio è leggibile (pg_restore --list) e contiene i dati attesi;
//   3. RIPRISTINO REALE in un Postgres locale usa-e-getta (Docker) e confronto
//      dei conteggi riga per riga con quelli registrati al momento del backup.
// Il container di prova viene sempre rimosso a fine verifica.
// Il database di produzione NON viene toccato: si legge solo il file locale.
//
// Uso: npx tsx prisma/verify-backup.ts backups/<file>.dump

import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

const PG_IMAGE = "postgres:17";
const dumpArg = process.argv[2];
if (!dumpArg) {
  console.error("Uso: npx tsx prisma/verify-backup.ts backups/<file>.dump");
  process.exit(1);
}
const dumpPath = resolve(dumpArg);
const dir = dirname(dumpPath);
const file = basename(dumpPath);
const manifestPath = join(dir, file.replace(/\.dump$/, ".manifest.json"));
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const expected: Record<string, number> = manifest.countsAfter;

const container = `lp-verify-${Date.now()}`;
const results: { check: string; ok: boolean; detail: string }[] = [];
const record = (check: string, ok: boolean, detail: string) => {
  results.push({ check, ok, detail });
  console.log(`${ok ? "OK  " : "FAIL"} ${check}: ${detail}`);
};

const docker = (args: string[]) =>
  spawnSync("docker", args, { encoding: "utf8", env: { ...process.env, MSYS_NO_PATHCONV: "1" } });

function psql(sql: string): string {
  const r = docker(["exec", container, "psql", "-U", "postgres", "-d", "postgres", "-tAc", sql]);
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stdout.trim();
}

async function main() {
  console.log(`Verifica backup: ${file}\n`);

  // 1) Impronta
  const sha = createHash("sha256").update(readFileSync(dumpPath)).digest("hex");
  record("Impronta SHA-256", sha === manifest.sha256, sha === manifest.sha256 ? "coincide con il manifest" : `diversa! ${sha}`);

  // 2) Leggibilità archivio
  const list = docker(["run", "--rm", "-v", `${dir}:/backup:ro`, PG_IMAGE, "pg_restore", "--list", `/backup/${file}`]);
  const toc = list.stdout ?? "";
  const dataEntries = toc.split("\n").filter((l) => / TABLE DATA public /.test(l)).length;
  const hasAuthUsers = / TABLE DATA auth users /.test(toc);
  record("Archivio leggibile", list.status === 0, `${toc.split("\n").length} voci nell'indice`);
  record("Dati tabelle applicative", dataEntries > 0, `${dataEntries} tabelle public con dati`);
  record("Account (auth.users)", hasAuthUsers, hasAuthUsers ? "presenti nell'archivio" : "MANCANTI");

  // 3) Ripristino reale in un Postgres usa-e-getta
  try {
    execFileSync("docker", [
      "run", "-d", "--name", container,
      "-e", "POSTGRES_PASSWORD=verify-only",
      "-v", `${dir}:/backup:ro`,
      PG_IMAGE,
    ], { stdio: "ignore", env: { ...process.env, MSYS_NO_PATHCONV: "1" } });

    // attesa avvio
    let ready = false;
    for (let i = 0; i < 60 && !ready; i++) {
      ready = docker(["exec", container, "pg_isready", "-U", "postgres"]).status === 0;
      if (!ready) await new Promise((r) => setTimeout(r, 1000));
    }
    if (!ready) throw new Error("Postgres di verifica non si è avviato");
    // pg_isready può rispondere prima del riavvio post-init: piccola attesa di sicurezza
    await new Promise((r) => setTimeout(r, 3000));

    // public: deve ripristinarsi pulito (tollerato solo "already exists" sullo schema)
    const rp = docker(["exec", container, "pg_restore", "--no-owner", "--no-privileges",
      "-U", "postgres", "-d", "postgres", "-n", "public", `/backup/${file}`]);
    const pubErrors = (rp.stderr ?? "").split("\n").filter((l) => /error:/i.test(l) && !/already exists/i.test(l));
    record("Ripristino schema public", pubErrors.length === 0,
      pubErrors.length === 0 ? "senza errori" : `${pubErrors.length} errori: ${pubErrors.slice(0, 3).join(" | ")}`);

    // auth: in un Postgres "vanilla" lo schema auth non esiste e "-t users"
    // ripristina solo la tabella (non lo schema): lo creiamo prima, poi
    // ripristiniamo struttura + righe degli account. Il controllo resta
    // rigoroso: il conteggio deve coincidere esattamente.
    psql("CREATE SCHEMA IF NOT EXISTS auth");
    const ra = docker(["exec", container, "pg_restore", "--no-owner", "--no-privileges",
      "-U", "postgres", "-d", "postgres", "-n", "auth", "-t", "users", `/backup/${file}`]);
    const authErrors = (ra.stderr ?? "").split("\n").filter((l) => /error:/i.test(l));
    record("Ripristino account (auth.users)", authErrors.length === 0,
      authErrors.length === 0 ? "senza errori" : `${authErrors.length} errori: ${authErrors.slice(0, 2).join(" | ")}`);

    // Confronto conteggi riga per riga
    let mismatches = 0;
    for (const [qualified, exp] of Object.entries(expected)) {
      const [schema, table] = qualified.split(".");
      let got: number | string;
      try {
        got = Number(psql(`SELECT count(*) FROM "${schema}"."${table}"`));
      } catch {
        got = "assente";
      }
      const ok = got === exp;
      if (!ok) mismatches++;
      record(`Righe ${qualified}`, ok, `backup ${got} / atteso ${exp}`);
    }
    record("Conteggi complessivi", mismatches === 0,
      mismatches === 0 ? `${Object.keys(expected).length} tabelle identiche` : `${mismatches} tabelle diverse`);
  } finally {
    docker(["rm", "-f", container]);
  }

  const passed = results.every((r) => r.ok);
  const report = { file, verifiedAt: new Date().toISOString(), passed, results };
  writeFileSync(join(dir, file.replace(/\.dump$/, ".verify.json")), JSON.stringify(report, null, 2));
  console.log(`\n${passed ? "BACKUP VERIFICATO: integro e ripristinabile." : "!!! VERIFICA FALLITA: NON procedere con cancellazioni."}`);
  process.exit(passed ? 0 : 1);
}

main().catch((e) => {
  docker(["rm", "-f", container]);
  console.error(e);
  process.exit(1);
});
