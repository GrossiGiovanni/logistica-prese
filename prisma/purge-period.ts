// Rimozione CONTROLLATA di prese e giri di un periodo dal database operativo.
//
// Pensato per essere difficile da usare per sbaglio:
//  - di default è una SIMULAZIONE: mostra cosa farebbe e non modifica nulla;
//  - per cancellare servono --execute E --confirm <prese>-<giri> con i numeri
//    esatti (si dichiara consapevolmente cosa si sta eliminando);
//  - prima di agire verifica: backup VERIFICATO e integro, archivio del periodo
//    integro e allineato ai dati attuali, nessun collegamento con altri mesi;
//  - tutto avviene in UN'UNICA TRANSAZIONE: elimina prima le fermate collegate
//    (nessun record orfano), poi giri e prese, e controlla che gli altri mesi
//    siano invariati prima di confermare. Qualsiasi anomalia => rollback totale.
//  - i resi NON vengono eliminati, salvo flag esplicito --include-resi.
//
// Uso:
//   npx tsx prisma/purge-period.ts 2026-07-01 2026-08-31 --backup backups/<file>.dump
//   npx tsx prisma/purge-period.ts 2026-07-01 2026-08-31 --backup backups/<file>.dump \
//       --execute --confirm 1246-744

import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

const args = process.argv.slice(2);
const [fromArg, toArg] = args;
const flag = (n: string) => args.includes(n);
const opt = (n: string) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};

const EXECUTE = flag("--execute");
const INCLUDE_RESI = flag("--include-resi");
const CONFIRM = opt("--confirm");
const BACKUP = opt("--backup");

function fail(msg: string): never {
  console.error(`\nINTERROTTO: ${msg}\n`);
  process.exit(1);
}

if (!/^\d{4}-\d{2}-\d{2}$/.test(fromArg ?? "") || !/^\d{4}-\d{2}-\d{2}$/.test(toArg ?? "")) {
  fail("periodo mancante. Uso: purge-period.ts AAAA-MM-GG AAAA-MM-GG --backup <file.dump>");
}
if (!BACKUP) fail("indica il backup verificato con --backup backups/<file>.dump");

const FROM = new Date(`${fromArg}T00:00:00.000Z`);
const TO = new Date(`${toArg}T00:00:00.000Z`);
const inPeriod = (d: Date) => d >= FROM && d <= TO;
const sha = (buf: Buffer | string) => createHash("sha256").update(buf).digest("hex");

const prisma = new PrismaClient();

/** Conteggi di prese/giri/fermate FUORI dal periodo (devono restare identici). */
async function outsideSnapshot() {
  return {
    prese: await prisma.pickup.count({ where: { OR: [{ pickupDate: { lt: FROM } }, { pickupDate: { gt: TO } }] } }),
    giri: await prisma.route.count({ where: { OR: [{ routeDate: { lt: FROM } }, { routeDate: { gt: TO } }] } }),
    fermate: await prisma.routeStop.count({
      where: { route: { OR: [{ routeDate: { lt: FROM } }, { routeDate: { gt: TO } }] } },
    }),
    resi: await prisma.reso.count({ where: { OR: [{ resoDate: { lt: FROM } }, { resoDate: { gt: TO } }] } }),
  };
}

async function main() {
  // Ambiente di destinazione SEMPRE in evidenza (senza password).
  if (!process.env.DATABASE_URL) process.loadEnvFile(".env");
  const t = new URL(process.env.DATABASE_URL!);
  console.log(`=== Rimozione prese e giri dal ${fromArg} al ${toArg} ===`);
  console.log(`Database di destinazione: ${decodeURIComponent(t.username)}@${t.hostname}${t.pathname}`);
  console.log(`Modalità: ${EXECUTE ? "ESECUZIONE" : "SIMULAZIONE (nessuna modifica)"}`);
  console.log(`Resi: ${INCLUDE_RESI ? "INCLUSI nella rimozione" : "mantenuti (non rimossi)"}\n`);

  // ---- 1. Backup: deve esistere, essere verificato e integro ----
  const dumpPath = resolve(BACKUP!);
  const dir = dirname(dumpPath);
  const verifyPath = join(dir, basename(dumpPath).replace(/\.dump$/, ".verify.json"));
  const manifestPath = join(dir, basename(dumpPath).replace(/\.dump$/, ".manifest.json"));
  if (!existsSync(dumpPath)) fail(`backup inesistente: ${dumpPath}`);
  if (!existsSync(verifyPath)) fail("il backup non è mai stato verificato (manca .verify.json). Esegui prisma/verify-backup.ts.");
  const verify = JSON.parse(readFileSync(verifyPath, "utf8"));
  const bManifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (!verify.passed) fail("la verifica del backup NON è passata.");
  if (sha(readFileSync(dumpPath)) !== bManifest.sha256) fail("il file di backup è stato alterato dopo la verifica (impronta diversa).");
  console.log(`OK  Backup verificato e integro: ${basename(dumpPath)} (verificato il ${verify.verifiedAt})`);

  // ---- 2. Archivio del periodo: deve esistere ed essere integro ----
  const archBase = join(dir, `archivio_prese-giri_${fromArg}_${toArg}`);
  if (!existsSync(`${archBase}.json`)) fail(`manca l'archivio del periodo. Esegui: npx tsx prisma/archive-period.ts ${fromArg} ${toArg}`);
  const archRaw = readFileSync(`${archBase}.json`, "utf8");
  const archMan = JSON.parse(readFileSync(`${archBase}.manifest.json`, "utf8"));
  if (sha(archRaw) !== archMan.sha256) fail("l'archivio è stato alterato (impronta diversa).");
  console.log(`OK  Archivio integro: ${basename(archBase)}.json`);

  // ---- 3. Perimetro attuale ----
  const pickups = await prisma.pickup.findMany({ where: { pickupDate: { gte: FROM, lte: TO } }, select: { id: true } });
  const routes = await prisma.route.findMany({ where: { routeDate: { gte: FROM, lte: TO } }, select: { id: true } });
  const pIds = pickups.map((p) => p.id);
  const rIds = routes.map((r) => r.id);
  const stops = await prisma.routeStop.findMany({
    where: { OR: [{ pickupId: { in: pIds } }, { routeId: { in: rIds } }] },
    select: { id: true, routeId: true, pickupId: true, resoId: true,
      route: { select: { routeDate: true } }, pickup: { select: { pickupDate: true } }, reso: { select: { resoDate: true } } },
  });
  const resi = INCLUDE_RESI
    ? await prisma.reso.findMany({ where: { resoDate: { gte: FROM, lte: TO } }, select: { id: true } })
    : [];

  // L'archivio deve coprire ESATTAMENTE ciò che verrà rimosso.
  if (archMan.conteggi.pickups !== pickups.length || archMan.conteggi.routes !== routes.length) {
    fail(`i dati sono cambiati dopo l'archiviazione (archivio: ${archMan.conteggi.pickups} prese/${archMan.conteggi.routes} giri, ` +
      `ora: ${pickups.length}/${routes.length}). Ricrea archivio e backup.`);
  }
  console.log("OK  L'archivio copre esattamente i dati attuali del periodo");

  // ---- 4. Collegamenti con altri mesi: devono essere zero ----
  const crossPickupOut = stops.filter((s) => s.pickup && inPeriod(s.pickup.pickupDate) && !inPeriod(s.route.routeDate));
  const crossRouteIn = stops.filter((s) => s.pickup && !inPeriod(s.pickup.pickupDate) && inPeriod(s.route.routeDate));
  const crossResoIn = stops.filter((s) => s.reso && !inPeriod(s.reso.resoDate) && inPeriod(s.route.routeDate));
  let crossResoOut = 0;
  if (INCLUDE_RESI) {
    crossResoOut = await prisma.routeStop.count({
      where: { resoId: { in: resi.map((r) => r.id) }, route: { OR: [{ routeDate: { lt: FROM } }, { routeDate: { gt: TO } }] } },
    });
  }
  const cross = crossPickupOut.length + crossRouteIn.length + crossResoIn.length + crossResoOut;
  if (cross > 0) {
    fail(`trovati ${cross} collegamenti con altri mesi (rimuoverli modificherebbe dati fuori periodo): ` +
      `prese->giri esterni ${crossPickupOut.length}, prese esterne->giri ${crossRouteIn.length}, ` +
      `resi esterni->giri ${crossResoIn.length}, resi->giri esterni ${crossResoOut}.`);
  }
  console.log("OK  Nessun collegamento con altri mesi");

  const resiStopsLeft = INCLUDE_RESI ? 0 : stops.filter((s) => s.resoId).length;
  console.log(`\nPIANO:
  fermate collegate da rimuovere : ${stops.length} (presa ${stops.filter((s) => s.pickupId).length}, reso ${stops.filter((s) => s.resoId).length})
  giri da rimuovere              : ${routes.length}
  prese da rimuovere             : ${pickups.length}
  resi da rimuovere              : ${INCLUDE_RESI ? resi.length : "nessuno (mantenuti)"}${
    resiStopsLeft ? `\n  nota: ${resiStopsLeft} resi del periodo perderanno il giro associato (restano consultabili)` : ""}`);

  const expectedConfirm = `${pickups.length}-${routes.length}`;
  if (!EXECUTE) {
    console.log(`\nSIMULAZIONE completata: nessuna modifica effettuata.`);
    console.log(`Per eseguire davvero:\n  npx tsx prisma/purge-period.ts ${fromArg} ${toArg} --backup ${BACKUP}${INCLUDE_RESI ? " --include-resi" : ""} --execute --confirm ${expectedConfirm}`);
    await prisma.$disconnect();
    return;
  }
  if (CONFIRM !== expectedConfirm) {
    fail(`conferma mancante o errata: serve --confirm ${expectedConfirm} (prese-giri).`);
  }

  // ---- 5. Esecuzione in un'unica transazione ----
  const before = await outsideSnapshot();
  const stopIds = stops.map((s) => s.id);
  const resoIds = resi.map((r) => r.id);

  const deleted = await prisma.$transaction(
    async (tx) => {
      // Ordine: prima le fermate (le relazioni), poi giri e prese, poi eventuali resi.
      const s = await tx.routeStop.deleteMany({ where: { id: { in: stopIds } } });
      const r = await tx.route.deleteMany({ where: { id: { in: rIds } } });
      const p = await tx.pickup.deleteMany({ where: { id: { in: pIds } } });
      const rs = INCLUDE_RESI ? await tx.reso.deleteMany({ where: { id: { in: resoIds } } }) : { count: 0 };

      // Controlli DENTRO la transazione: se falliscono, rollback totale.
      if (s.count !== stopIds.length || r.count !== rIds.length || p.count !== pIds.length || rs.count !== resoIds.length) {
        throw new Error(`conteggi inattesi (fermate ${s.count}/${stopIds.length}, giri ${r.count}/${rIds.length}, prese ${p.count}/${pIds.length})`);
      }
      const leftInPeriod =
        (await tx.pickup.count({ where: { pickupDate: { gte: FROM, lte: TO } } })) +
        (await tx.route.count({ where: { routeDate: { gte: FROM, lte: TO } } }));
      if (leftInPeriod !== 0) throw new Error(`restano ${leftInPeriod} prese/giri nel periodo`);
      return { fermate: s.count, giri: r.count, prese: p.count, resi: rs.count };
    },
    { timeout: 120_000, maxWait: 30_000 },
  );

  // ---- 6. Verifica finale: altri mesi invariati, nessun orfano ----
  const after = await outsideSnapshot();
  const untouched = before.prese === after.prese && before.giri === after.giri && before.fermate === after.fermate && before.resi === after.resi;
  const orphanStops = await prisma.routeStop.count({ where: { pickupId: null, resoId: null } });

  const log = {
    periodo: { da: fromArg, a: toArg },
    eseguitoIl: new Date().toISOString(),
    backup: basename(dumpPath),
    archivio: `${basename(archBase)}.json`,
    eliminati: deleted,
    altriMesi: { prima: before, dopo: after, invariati: untouched },
    fermateOrfane: orphanStops,
  };
  writeFileSync(join(dir, `purge_${fromArg}_${toArg}_${Date.now()}.log.json`), JSON.stringify(log, null, 2));

  console.log(`\nESEGUITO. Eliminati: ${JSON.stringify(deleted)}`);
  console.log(`Altri mesi invariati: ${untouched ? "sì" : "NO — controllare!"}`);
  console.log(`Fermate orfane: ${orphanStops}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(`\nERRORE (transazione annullata, nessuna modifica applicata): ${e instanceof Error ? e.message : e}`);
  await prisma.$disconnect();
  process.exit(1);
});
