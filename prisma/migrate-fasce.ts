// Normalizza le prese con fascia SPECIFIC (vecchio "orario preciso") nelle 3
// fasce operative: mattina/pomeriggio in base all'ora, altrimenti giornata intera.
// L'orario eventuale resta in timeFrom. Esecuzione: npx tsx prisma/migrate-fasce.ts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const specific = await prisma.pickup.findMany({ where: { timeWindow: "SPECIFIC" } });
  let morning = 0;
  let afternoon = 0;
  let anytime = 0;
  for (const p of specific) {
    let tw: "MORNING" | "AFTERNOON" | "ANYTIME" = "ANYTIME";
    const hour = p.timeFrom ? parseInt(p.timeFrom.slice(0, 2), 10) : NaN;
    if (!Number.isNaN(hour)) {
      tw = hour < 13 ? "MORNING" : "AFTERNOON";
    }
    await prisma.pickup.update({ where: { id: p.id }, data: { timeWindow: tw } });
    if (tw === "MORNING") morning++;
    else if (tw === "AFTERNOON") afternoon++;
    else anytime++;
  }
  console.log(`Prese SPECIFIC migrate: ${specific.length} (mattina ${morning}, pomeriggio ${afternoon}, giornata ${anytime})`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
