// Archivio LOCALE (JSON) di prese, giri e relative associazioni di un periodo.
//
// Complementare al backup pg_dump: è leggibile senza Postgres e contiene le
// righe grezze esattamente come nel database (ri-inseribili), più tabelle di
// decodifica (clienti, indirizzi, autisti, mezzi) per consultarlo a colpo d'occhio.
// Sola lettura: non modifica nulla.
//
// Uso: npx tsx prisma/archive-period.ts 2026-07-01 2026-08-31

import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const [fromArg, toArg] = process.argv.slice(2);
if (!/^\d{4}-\d{2}-\d{2}$/.test(fromArg ?? "") || !/^\d{4}-\d{2}-\d{2}$/.test(toArg ?? "")) {
  console.error("Uso: npx tsx prisma/archive-period.ts AAAA-MM-GG AAAA-MM-GG");
  process.exit(1);
}
const FROM = new Date(`${fromArg}T00:00:00.000Z`);
const TO = new Date(`${toArg}T00:00:00.000Z`);

const prisma = new PrismaClient();

async function main() {
  const pickups = await prisma.pickup.findMany({ where: { pickupDate: { gte: FROM, lte: TO } }, orderBy: { pickupDate: "asc" } });
  const routes = await prisma.route.findMany({ where: { routeDate: { gte: FROM, lte: TO } }, orderBy: { routeDate: "asc" } });
  const pIds = pickups.map((p) => p.id);
  const rIds = routes.map((r) => r.id);

  // Associazioni: ogni fermata che tocca una presa o un giro del periodo.
  const routeStops = await prisma.routeStop.findMany({
    where: { OR: [{ pickupId: { in: pIds } }, { routeId: { in: rIds } }] },
    orderBy: [{ routeId: "asc" }, { sequence: "asc" }],
  });

  // Resi: quelli datati nel periodo e quelli agganciati ai giri del periodo.
  const resoIds = [...new Set(routeStops.map((s) => s.resoId).filter((x): x is string => !!x))];
  const resi = await prisma.reso.findMany({
    where: { OR: [{ resoDate: { gte: FROM, lte: TO } }, { id: { in: resoIds } }] },
    orderBy: { resoDate: "asc" },
  });

  // Tabelle di decodifica per la consultazione.
  const custIds = [...new Set([...pickups.map((p) => p.customerId), ...resi.map((r) => r.customerId)])];
  const addrIds = [...new Set([...pickups.map((p) => p.addressId), ...resi.map((r) => r.addressId)].filter((x): x is string => !!x))];
  const drvIds = [...new Set(routes.map((r) => r.driverId).filter((x): x is string => !!x))];
  const vehIds = [...new Set(routes.map((r) => r.vehicleId).filter((x): x is string => !!x))];
  const [customers, addresses, drivers, vehicles] = await Promise.all([
    prisma.customer.findMany({ where: { id: { in: custIds } }, select: { id: true, name: true } }),
    prisma.address.findMany({ where: { id: { in: addrIds } }, select: { id: true, street: true, city: true, province: true } }),
    prisma.driver.findMany({ where: { id: { in: drvIds } }, select: { id: true, name: true } }),
    prisma.vehicle.findMany({ where: { id: { in: vehIds } }, select: { id: true, name: true, plate: true } }),
  ]);

  const counts = {
    pickups: pickups.length,
    routes: routes.length,
    routeStops: routeStops.length,
    routeStopsPresa: routeStops.filter((s) => s.pickupId).length,
    routeStopsReso: routeStops.filter((s) => s.resoId).length,
    resi: resi.length,
  };

  const archive = {
    meta: {
      descrizione: "Archivio prese, giri e associazioni — righe grezze del database",
      periodo: { da: fromArg, a: toArg },
      creatoIl: new Date().toISOString(),
      conteggi: counts,
    },
    pickups,
    routes,
    routeStops,
    resi,
    decodifica: {
      clienti: Object.fromEntries(customers.map((c) => [c.id, c.name])),
      indirizzi: Object.fromEntries(addresses.map((a) => [a.id, `${a.street}, ${a.city} (${a.province})`])),
      autisti: Object.fromEntries(drivers.map((d) => [d.id, d.name])),
      mezzi: Object.fromEntries(vehicles.map((v) => [v.id, `${v.name}${v.plate ? ` ${v.plate}` : ""}`])),
    },
  };

  const outDir = resolve("backups");
  mkdirSync(outDir, { recursive: true });
  const name = `archivio_prese-giri_${fromArg}_${toArg}`;
  const json = JSON.stringify(archive, null, 2);
  const sha256 = createHash("sha256").update(json).digest("hex");
  writeFileSync(join(outDir, `${name}.json`), json);
  writeFileSync(
    join(outDir, `${name}.manifest.json`),
    JSON.stringify({ file: `${name}.json`, bytes: Buffer.byteLength(json), sha256, periodo: archive.meta.periodo, conteggi: counts }, null, 2),
  );

  console.log(`Archivio: backups/${name}.json (${Buffer.byteLength(json).toLocaleString("it-IT")} byte)`);
  console.log(`SHA-256: ${sha256}`);
  console.table(counts);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
