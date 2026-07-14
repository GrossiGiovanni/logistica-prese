// Ricalcola i km di tutti i giri con fermate (utile dopo aver attivato la
// chiave Google, per popolare i giri creati quando la chiave non c'era ancora).
// Esecuzione: npx tsx prisma/backfill-km.ts
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { computeRouteKm } from "../src/lib/distance";

const prisma = new PrismaClient();

async function main() {
  const routes = await prisma.route.findMany({
    include: {
      vehicle: { select: { name: true } },
      stops: {
        orderBy: { sequence: "asc" },
        include: { pickup: { include: { address: true } } },
      },
    },
  });

  for (const r of routes) {
    if (r.stops.length === 0) continue;
    const result = await computeRouteKm(r.stops.map((s) => s.pickup.address));
    if (result.km != null) {
      await prisma.route.update({ where: { id: r.id }, data: { km: result.km } });
      console.log(`  ${r.vehicle?.name ?? "-"}: ${result.km} km`);
    } else {
      console.log(`  ${r.vehicle?.name ?? "-"}: non calcolato (${result.reason})`);
    }
  }
}
main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
