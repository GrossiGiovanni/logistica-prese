// Setup one-shot (idempotente) del volume tassabile storico: per le prese già
// eseguite (assegnate a un giro) il volume presente proviene dall'aggiornamento
// AS400, quindi lo copiamo in taxableVolumeM3. Le prese future lo ricevono
// direttamente dall'import.
//
// Nota: la ripartizione costi NON richiede setup: usa il flag "Autista
// Eurosarda" già presente in anagrafica (Eurosarda = industriale).
//
// Uso: npx tsx prisma/setup-costi-volume.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Autisti che generano costo industriale (flotta Eurosarda).
  const eurosarda = await prisma.driver.findMany({
    where: { isEurosarda: true },
    select: { name: true, active: true },
    orderBy: { name: "asc" },
  });
  console.log("Autisti Eurosarda (costo industriale):");
  console.table(eurosarda);

  // --- Volume tassabile storico ---
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
