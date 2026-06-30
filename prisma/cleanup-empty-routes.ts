// Rimuove i giri vuoti (DRAFT senza prese assegnate) rimasti in database dalla
// vecchia generazione automatica. Esecuzione: npx tsx prisma/cleanup-empty-routes.ts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const empty = await prisma.route.findMany({
    where: { status: "DRAFT", stops: { none: {} } },
    select: { id: true },
  });
  if (empty.length === 0) {
    console.log("Nessun giro vuoto da rimuovere.");
    return;
  }
  await prisma.route.deleteMany({ where: { id: { in: empty.map((e) => e.id) } } });
  console.log(`Rimossi ${empty.length} giri vuoti (DRAFT senza prese).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
