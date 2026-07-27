// Migrazione multi-filiale (one-shot):
// - crea le filiali Milano (MI) e Torino (TO)
// - assegna TUTTI i dati esistenti alla filiale Milano
// - Torino resta vuota (anagrafiche caricate manualmente nel tempo)
//
// Idempotente: usa upsert sul codice filiale e aggiorna solo i record con
// branchId ancora nullo, quindi può essere rieseguito senza rischi.
//
// Uso: npx tsx prisma/migrate-branches.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const milano = await prisma.branch.upsert({
    where: { code: "MI" },
    update: {},
    create: { name: "Milano", code: "MI", active: true },
  });
  const torino = await prisma.branch.upsert({
    where: { code: "TO" },
    update: {},
    create: { name: "Torino", code: "TO", active: true },
  });

  console.log(`Filiali: Milano=${milano.id}  Torino=${torino.id}`);

  const miId = milano.id;

  // Assegna a Milano ogni record ancora senza filiale.
  const results = {
    customers: (await prisma.customer.updateMany({ where: { branchId: null }, data: { branchId: miId } })).count,
    drivers: (await prisma.driver.updateMany({ where: { branchId: null }, data: { branchId: miId } })).count,
    vehicles: (await prisma.vehicle.updateMany({ where: { branchId: null }, data: { branchId: miId } })).count,
    pickups: (await prisma.pickup.updateMany({ where: { branchId: null }, data: { branchId: miId } })).count,
    recurringPickups: (await prisma.recurringPickup.updateMany({ where: { branchId: null }, data: { branchId: miId } })).count,
    routes: (await prisma.route.updateMany({ where: { branchId: null }, data: { branchId: miId } })).count,
    resi: (await prisma.reso.updateMany({ where: { branchId: null }, data: { branchId: miId } })).count,
    tractions: (await prisma.traction.updateMany({ where: { branchId: null }, data: { branchId: miId } })).count,
    trailerLogs: (await prisma.trailerLog.updateMany({ where: { branchId: null }, data: { branchId: miId } })).count,
    importLogs: (await prisma.importLog.updateMany({ where: { branchId: null }, data: { branchId: miId } })).count,
  };

  console.log("Record assegnati a Milano:");
  console.table(results);
  console.log("Fatto. Torino è vuota e pronta per il caricamento manuale.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
