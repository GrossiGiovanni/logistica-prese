// Setup one-shot (idempotente) per:
//  1) i flag di ripartizione costi: Gregory = giri + trazioni industriali,
//     Simone = solo trazioni industriali. Da qui in poi si gestiscono
//     dall'anagrafica autisti (nessun nome cablato nella logica).
//  2) il volume tassabile storico: per le prese già eseguite (assegnate a un
//     giro) il volume presente proviene dall'aggiornamento AS400, quindi lo
//     copiamo in taxableVolumeM3. Le prese future lo ricevono dall'import.
//
// Uso: npx tsx prisma/setup-costi-volume.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // --- 1) Flag ripartizione costi ---
  const gregory = await prisma.driver.updateMany({
    where: { name: { contains: "GREGORY", mode: "insensitive" } },
    data: { industrialRoutes: true, industrialTractions: true },
  });
  const simone = await prisma.driver.updateMany({
    where: { name: { contains: "SIMONE", mode: "insensitive" } },
    data: { industrialTractions: true },
  });
  console.log(`Flag costi — Gregory: ${gregory.count} autisti, Simone: ${simone.count} autisti`);

  const marked = await prisma.driver.findMany({
    where: { OR: [{ industrialRoutes: true }, { industrialTractions: true }] },
    select: { name: true, industrialRoutes: true, industrialTractions: true },
    orderBy: { name: "asc" },
  });
  console.table(marked);

  // --- 2) Volume tassabile storico ---
  const candidate = await prisma.pickup.count({
    where: {
      taxableVolumeM3: null,
      volumeM3: { not: null },
      routeStops: { some: {} }, // solo prese effettivamente eseguite/assegnate
    },
  });
  // updateMany non sa copiare colonna->colonna: serve SQL grezzo.
  const copied = await prisma.$executeRaw`
    UPDATE "Pickup" p
    SET "taxableVolumeM3" = p."volumeM3"
    WHERE p."taxableVolumeM3" IS NULL
      AND p."volumeM3" IS NOT NULL
      AND EXISTS (SELECT 1 FROM "RouteStop" rs WHERE rs."pickupId" = p."id")
  `;
  console.log(`Volume tassabile allineato su ${copied} prese già eseguite (candidate: ${candidate}).`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
