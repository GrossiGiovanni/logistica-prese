// Rimuove i giri vuoti (DRAFT senza prese né resi) rimasti in database dalla
// vecchia generazione automatica.
//
// SICUREZZA:
//  - di default è una SIMULAZIONE (dry-run): mostra cosa rimuoverebbe e basta;
//  - per cancellare davvero serve il flag esplicito --execute;
//  - le bozze recenti NON vengono mai toccate: con il salvataggio automatico in
//    bozza un giro vuoto può essere un lavoro in corso di un operatore.
//
// Uso:
//   npx tsx prisma/cleanup-empty-routes.ts            (simulazione)
//   npx tsx prisma/cleanup-empty-routes.ts --execute  (cancella)
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const EXECUTE = process.argv.includes("--execute");
const KEEP_RECENT_DAYS = 7; // bozze più recenti di così sono considerate lavoro in corso

async function main() {
  const cutoff = new Date(Date.now() - KEEP_RECENT_DAYS * 24 * 60 * 60 * 1000);
  const empty = await prisma.route.findMany({
    where: { status: "DRAFT", stops: { none: {} }, updatedAt: { lt: cutoff } },
    select: { id: true, routeDate: true, driver: { select: { name: true } } },
    orderBy: { routeDate: "asc" },
  });

  if (empty.length === 0) {
    console.log(`Nessun giro vuoto più vecchio di ${KEEP_RECENT_DAYS} giorni da rimuovere.`);
    return;
  }

  console.log(`Giri vuoti (DRAFT senza fermate, fermi da >${KEEP_RECENT_DAYS} gg): ${empty.length}`);
  for (const r of empty.slice(0, 20)) {
    console.log(`  ${r.routeDate.toISOString().slice(0, 10)}  ${r.driver?.name ?? "—"}  (${r.id})`);
  }
  if (empty.length > 20) console.log(`  … e altri ${empty.length - 20}`);

  if (!EXECUTE) {
    console.log("\nSIMULAZIONE: nessuna modifica. Rilancia con --execute per cancellare.");
    return;
  }

  const res = await prisma.route.deleteMany({ where: { id: { in: empty.map((e) => e.id) } } });
  console.log(`\nRimossi ${res.count} giri vuoti.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
