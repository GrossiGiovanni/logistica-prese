// Aggiornamenti dati una-tantum per le modifiche operative:
//  #2 Prese fisse operative lun-ven (tutte le ricorrenze attive: lun-ven on, sab/dom off)
//  #5 Costi bilici: dailyCost 400 (=> 200 mattina + 200 pomeriggio), motrici 300
// Esecuzione: npx tsx prisma/apply-ops-changes.ts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // #2 — tutte le prese fisse attive operative lun-ven
  const rec = await prisma.recurringPickup.updateMany({
    where: { active: true },
    data: {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: false,
      sunday: false,
    },
  });
  console.log(`#2 Prese fisse impostate lun-ven: ${rec.count} ricorrenze`);

  // #5 — costi mezzi per tipo
  const bilici = await prisma.vehicle.updateMany({
    where: { vehicleType: "BILICO" },
    data: { dailyCost: 400 },
  });
  const motrici = await prisma.vehicle.updateMany({
    where: { vehicleType: "MOTRICE" },
    data: { dailyCost: 300 },
  });
  console.log(`#5 Costo giornaliero: bilici=${bilici.count} a 400€, motrici=${motrici.count} a 300€`);
  console.log("   (mezza giornata = metà: bilico 200, motrice 150)");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
