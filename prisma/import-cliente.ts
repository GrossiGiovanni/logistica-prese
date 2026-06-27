// Import dei dati reali del cliente (reset pulito).
// Sorgente: prisma/seed-data/bundle.json (generato da build_bundle.py dai 5 xlsx).
//
// Crea: mezzi + autisti (da AUTISTI), clienti + indirizzi (dedup), prese (da PRESE
// WEEK 26 + 23.06) con parsing NOTE, e il registro prese fisse. Le prese che
// corrispondono (mittente+località) alla lista fissa sono taggate sourceType=RECURRING.
//
// Esecuzione: npx tsx prisma/import-cliente.ts
import { PrismaClient, type VehicleType, type CostLevel } from "@prisma/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const prisma = new PrismaClient();
const BUNDLE = join(__dirname, "seed-data", "bundle.json");

type Driver = { codice: string | null; autista: string; mezzo: string; targa: string | null; titolare: string | null };
type Fixed = { mittente: string; street: string; city: string; province: string | null };
type Pickup = {
  numero: string | null;
  date: string | null;
  mittente: string;
  street: string | null;
  city: string | null;
  province: string | null;
  note: string | null;
  pallets: number | null;
  loadingMeters: number | null;
  volumeM3: number | null;
  weightKg: number | null;
  colli: number | null;
  timeWindow: "MORNING" | "AFTERNOON" | "ANYTIME" | "SPECIFIC";
  timeFrom: string | null;
  requiresMotrice: boolean;
  destination: string | null;
};
type Bundle = { drivers: Driver[]; fixed: Fixed[]; pickups: Pickup[] };

/** Chiave di normalizzazione per il dedup/match (maiuscolo, senza punteggiatura). */
const key = (s: string | null | undefined) =>
  (s ?? "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();

// Specifiche capienza/costo per tipo mezzo (da "dati da inserire dashboard prese").
const SPECS: Record<"BILICO" | "MOTRICE", {
  vehicleType: VehicleType;
  capacityPallets: number;
  capacityVolumeM3: number;
  capacityWeightKg: number;
  dailyCost: number;
  costLevel: CostLevel;
}> = {
  BILICO: { vehicleType: "BILICO", capacityPallets: 33, capacityVolumeM3: 60, capacityWeightKg: 25000, dailyCost: 400, costLevel: "MEDIUM" },
  MOTRICE: { vehicleType: "MOTRICE", capacityPallets: 18, capacityVolumeM3: 30, capacityWeightKg: 6500, dailyCost: 300, costLevel: "HIGH" },
};

async function main() {
  const bundle: Bundle = JSON.parse(readFileSync(BUNDLE, "utf-8"));
  console.log(`Bundle: ${bundle.drivers.length} autisti, ${bundle.fixed.length} fisse, ${bundle.pickups.length} prese`);

  // --- RESET COMPLETO (compresi mezzi e autisti, ora reali) ---
  console.log("Reset dati esistenti...");
  await prisma.routeStop.deleteMany();
  await prisma.route.deleteMany();
  await prisma.pickup.deleteMany();
  await prisma.recurringPickup.deleteMany();
  await prisma.address.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.driver.deleteMany();
  await prisma.vehicle.deleteMany();

  // --- MEZZI + AUTISTI ---
  const vehicleByTarga = new Map<string, string>();
  let vehiclesCreated = 0;
  for (const d of bundle.drivers) {
    const type = d.mezzo === "MOTRICE" ? "MOTRICE" : "BILICO";
    const spec = SPECS[type];
    const targaKey = key(d.targa) || `NO-TARGA-${d.autista}`;
    let vehicleId = vehicleByTarga.get(targaKey);
    if (!vehicleId) {
      const v = await prisma.vehicle.create({
        data: {
          name: `${type} ${d.targa ?? d.autista}`,
          plate: d.targa ?? undefined,
          owner: d.titolare ?? undefined,
          ...spec,
        },
      });
      vehicleId = v.id;
      vehicleByTarga.set(targaKey, vehicleId);
      vehiclesCreated++;
    }
    await prisma.driver.create({
      data: { name: d.autista, code: d.codice ?? undefined, defaultVehicleId: vehicleId },
    });
  }

  // --- CLIENTI + INDIRIZZI (dedup) ---
  const customerByName = new Map<string, string>();
  const addressByKey = new Map<string, string>();

  async function ensureCustomer(name: string): Promise<string> {
    const k = key(name);
    let id = customerByName.get(k);
    if (!id) {
      const c = await prisma.customer.create({ data: { name } });
      id = c.id;
      customerByName.set(k, id);
    }
    return id;
  }

  async function ensureAddress(customerId: string, street: string, city: string, province: string | null): Promise<string> {
    const k = `${customerId}|${key(street)}|${key(city)}`;
    let id = addressByKey.get(k);
    if (!id) {
      const a = await prisma.address.create({
        data: { customerId, street, city, province: province ?? "" },
      });
      id = a.id;
      addressByKey.set(k, id);
    }
    return id;
  }

  // --- REGISTRO PRESE FISSE + set per il tagging (match su mittente+città) ---
  const fixedSet = new Set<string>();
  for (const f of bundle.fixed) {
    fixedSet.add(`${key(f.mittente)}|${key(f.city)}`);
    const customerId = await ensureCustomer(f.mittente);
    const addressId = await ensureAddress(customerId, f.street, f.city, f.province);
    await prisma.recurringPickup.create({
      data: {
        customerId,
        addressId,
        active: true,
        // Tutti i giorni a false: generazione disattivata (le prese fisse
        // arrivano dall'export e vengono taggate). Registro solo di riferimento.
        defaultNotes: "Presa fissa giornaliera (taggata sull'export)",
      },
    });
  }

  // --- PRESE ---
  let pickupsCreated = 0;
  let tagged = 0;
  let skipped = 0;
  for (const p of bundle.pickups) {
    if (!p.date || !p.street || !p.city) {
      skipped++;
      continue;
    }
    const customerId = await ensureCustomer(p.mittente);
    const addressId = await ensureAddress(customerId, p.street, p.city, p.province);

    const isFixed = fixedSet.has(`${key(p.mittente)}|${key(p.city)}`);
    if (isFixed) tagged++;

    const hasData = p.pallets != null || p.loadingMeters != null || p.volumeM3 != null;

    await prisma.pickup.create({
      data: {
        pickupNumber: p.numero ?? undefined,
        pickupDate: new Date(`${p.date}T00:00:00.000Z`),
        customerId,
        addressId,
        sourceType: isFixed ? "RECURRING" : "SPOT",
        status: hasData ? "READY" : "DRAFT",
        timeWindow: p.timeWindow,
        timeFrom: p.timeFrom ?? undefined,
        pallets: p.pallets ?? undefined,
        colli: p.colli ?? undefined,
        loadingMeters: p.loadingMeters ?? undefined,
        weightKg: p.weightKg ?? undefined,
        volumeM3: p.volumeM3 ?? undefined,
        destination: p.destination ?? undefined,
        requiresMotrice: p.requiresMotrice,
        rawNotes: p.note ?? undefined,
      },
    });
    pickupsCreated++;
  }

  console.log("\nImport completato.");
  console.log(`  Mezzi:     ${vehiclesCreated}`);
  console.log(`  Autisti:   ${bundle.drivers.length}`);
  console.log(`  Clienti:   ${customerByName.size}`);
  console.log(`  Indirizzi: ${addressByKey.size}`);
  console.log(`  Prese fisse (registro): ${bundle.fixed.length}`);
  console.log(`  Prese:     ${pickupsCreated} (di cui ${tagged} taggate come fisse, ${skipped} saltate)`);

  // Riepilogo date per orientarsi nella UI
  const byDate = new Map<string, number>();
  for (const p of bundle.pickups) {
    if (p.date) byDate.set(p.date, (byDate.get(p.date) ?? 0) + 1);
  }
  console.log("  Date prese:");
  [...byDate.entries()].sort().forEach(([d, n]) => console.log(`    ${d}: ${n}`));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
