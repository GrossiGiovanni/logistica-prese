// Seed dati demo — dati fittizi ma realistici (province lombarde).
// Eseguito con: npm run db:seed  (prisma -> tsx prisma/seed.ts)

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Date helper (mezzanotte UTC) ----------------------------------------------
function dateOnly(offsetDays: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d;
}
const TOMORROW = dateOnly(1);

async function main() {
  console.log("⏳ Pulizia tabelle...");
  // Ordine inverso rispetto alle dipendenze.
  await prisma.routeStop.deleteMany();
  await prisma.route.deleteMany();
  await prisma.pickup.deleteMany();
  await prisma.recurringPickup.deleteMany();
  await prisma.address.deleteMany();
  await prisma.driver.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.customer.deleteMany();

  // -------------------------------------------------------------------------
  // MEZZI — 13 totali, di cui 2 MOTRICE
  // -------------------------------------------------------------------------
  console.log("🚚 Creazione mezzi...");
  const vehiclesData = [
    { name: "Furgone 1", plate: "AB123CD", vehicleType: "VAN" as const, capacityPallets: 8, hasTailLift: true, costLevel: "LOW" as const },
    { name: "Furgone 2", plate: "AB124CD", vehicleType: "VAN" as const, capacityPallets: 8, hasTailLift: false, costLevel: "LOW" as const },
    { name: "Furgone 3", plate: "AB125CD", vehicleType: "VAN" as const, capacityPallets: 10, hasTailLift: true, costLevel: "LOW" as const },
    { name: "Furgone 4", plate: "AB126CD", vehicleType: "VAN" as const, capacityPallets: 10, hasTailLift: true, costLevel: "MEDIUM" as const },
    { name: "Camion 1", plate: "EC201FG", vehicleType: "TRUCK" as const, capacityPallets: 16, hasTailLift: true, costLevel: "MEDIUM" as const },
    { name: "Camion 2", plate: "EC202FG", vehicleType: "TRUCK" as const, capacityPallets: 16, hasTailLift: true, costLevel: "MEDIUM" as const },
    { name: "Camion 3", plate: "EC203FG", vehicleType: "TRUCK" as const, capacityPallets: 18, hasTailLift: false, costLevel: "MEDIUM" as const },
    { name: "Camion 4", plate: "EC204FG", vehicleType: "TRUCK" as const, capacityPallets: 18, hasTailLift: true, costLevel: "MEDIUM" as const },
    { name: "Camion 5", plate: "EC205FG", vehicleType: "TRUCK" as const, capacityPallets: 20, hasTailLift: true, costLevel: "MEDIUM" as const },
    { name: "Camion 6", plate: "EC206FG", vehicleType: "TRUCK" as const, capacityPallets: 20, hasTailLift: false, costLevel: "MEDIUM" as const },
    { name: "Camion 7", plate: "EC207FG", vehicleType: "TRUCK" as const, capacityPallets: 22, hasTailLift: true, costLevel: "MEDIUM" as const },
    { name: "Motrice 1", plate: "GH301IL", vehicleType: "MOTRICE" as const, capacityPallets: 33, hasTailLift: true, costLevel: "HIGH" as const },
    { name: "Motrice 2", plate: "GH302IL", vehicleType: "MOTRICE" as const, capacityPallets: 33, hasTailLift: true, costLevel: "HIGH" as const },
  ];
  const vehicles = [];
  for (const v of vehiclesData) {
    vehicles.push(await prisma.vehicle.create({ data: v }));
  }

  // -------------------------------------------------------------------------
  // AUTISTI — 5
  // -------------------------------------------------------------------------
  console.log("👷 Creazione autisti...");
  const driversData = [
    { name: "Marco Rossi", phone: "333 1112233", defaultVehicleId: vehicles[0].id },
    { name: "Luca Bianchi", phone: "333 2223344", defaultVehicleId: vehicles[4].id },
    { name: "Paolo Verdi", phone: "333 3334455", defaultVehicleId: vehicles[11].id },
    { name: "Andrea Colombo", phone: "333 4445566", defaultVehicleId: vehicles[5].id },
    { name: "Stefano Ferrari", phone: "333 5556677", defaultVehicleId: null },
  ];
  const drivers = [];
  for (const d of driversData) {
    drivers.push(await prisma.driver.create({ data: { ...d, active: true } }));
  }

  // -------------------------------------------------------------------------
  // CLIENTI + INDIRIZZI — 10 clienti, 12 indirizzi
  // -------------------------------------------------------------------------
  console.log("🏢 Creazione clienti e indirizzi...");
  const customersData: {
    name: string;
    vatNumber?: string;
    phone?: string;
    email?: string;
    addresses: {
      label?: string;
      street: string;
      city: string;
      province: string;
      postalCode?: string;
    }[];
  }[] = [
    {
      name: "Alimentari Lombardi S.r.l.",
      vatNumber: "IT01234567890",
      phone: "02 1234567",
      email: "ordini@alimentarilombardi.it",
      addresses: [
        { label: "Sede principale", street: "Via Milano 12", city: "Milano", province: "MI", postalCode: "20100" },
        { label: "Magazzino", street: "Via dell'Industria 5", city: "Cusago", province: "MI", postalCode: "20090" },
      ],
    },
    {
      name: "Pavia Distribuzione S.p.A.",
      vatNumber: "IT02345678901",
      phone: "0382 445566",
      addresses: [{ label: "Magazzino", street: "Strada Nuova 88", city: "Pavia", province: "PV", postalCode: "27100" }],
    },
    {
      name: "Brianza Food S.r.l.",
      phone: "039 778899",
      email: "logistica@brianzafood.it",
      addresses: [{ label: "Produzione", street: "Viale delle Industrie 22", city: "Monza", province: "MB", postalCode: "20900" }],
    },
    {
      name: "Lecco Beverage S.r.l.",
      addresses: [{ label: "Sede principale", street: "Via Lungolago 4", city: "Lecco", province: "LC", postalCode: "23900" }],
    },
    {
      name: "San Donato Logistica S.r.l.",
      vatNumber: "IT03456789012",
      addresses: [{ label: "Hub", street: "Via Emilia 140", city: "San Donato Milanese", province: "MI", postalCode: "20097" }],
    },
    {
      name: "Lodi Carni S.r.l.",
      phone: "0371 112233",
      addresses: [{ label: "Stabilimento", street: "Via Agricola 9", city: "Lodi", province: "LO", postalCode: "26900" }],
    },
    {
      name: "Cusago Imballaggi S.n.c.",
      addresses: [{ label: "Magazzino", street: "Via Roma 3", city: "Cusago", province: "MI", postalCode: "20090" }],
    },
    {
      name: "Milano Sud Ortofrutta S.r.l.",
      email: "ordini@milanosud.it",
      addresses: [
        { label: "Mercato", street: "Via Lombroso 54", city: "Milano", province: "MI", postalCode: "20137" },
        { label: "Deposito", street: "Via Mecenate 90", city: "Milano", province: "MI", postalCode: "20138" },
      ],
    },
    {
      name: "Monza Surgelati S.r.l.",
      vatNumber: "IT04567890123",
      addresses: [{ label: "Cella frigo", street: "Via Borgazzi 200", city: "Monza", province: "MB", postalCode: "20900" }],
    },
    {
      name: "Pavia Cartotecnica S.p.A.",
      phone: "0382 998877",
      addresses: [{ label: "Sede", street: "Via Riviera 31", city: "Pavia", province: "PV", postalCode: "27100" }],
    },
  ];

  const customers = [];
  for (const c of customersData) {
    const { addresses, ...customerFields } = c;
    const customer = await prisma.customer.create({
      data: {
        ...customerFields,
        addresses: { create: addresses.map((a) => ({ ...a, country: "IT" })) },
      },
      include: { addresses: true },
    });
    customers.push(customer);
  }

  // -------------------------------------------------------------------------
  // PRESE FISSE / RICORRENTI
  // -------------------------------------------------------------------------
  console.log("🔁 Creazione prese fisse...");
  await prisma.recurringPickup.create({
    data: {
      customerId: customers[0].id,
      addressId: customers[0].addresses[0].id,
      active: true,
      monday: true, tuesday: true, wednesday: true, thursday: true, friday: true,
      defaultTimeWindow: "MORNING",
      defaultPallets: 4,
      defaultColli: 20,
      defaultPriority: "NORMAL",
      defaultNotes: "Ritiro giornaliero bancali resi.",
    },
  });
  await prisma.recurringPickup.create({
    data: {
      customerId: customers[2].id,
      addressId: customers[2].addresses[0].id,
      active: true,
      monday: true, wednesday: true, friday: true,
      defaultTimeWindow: "AFTERNOON",
      defaultPallets: 6,
      defaultRequiresTailLift: true,
      defaultPriority: "HIGH",
      defaultNotes: "Sponda obbligatoria, banchina stretta.",
    },
  });
  await prisma.recurringPickup.create({
    data: {
      customerId: customers[8].id,
      addressId: customers[8].addresses[0].id,
      active: true,
      tuesday: true, thursday: true,
      defaultTimeWindow: "MORNING",
      defaultPallets: 10,
      defaultRequiresMotrice: true,
      defaultPriority: "MANDATORY",
      defaultNotes: "Carico surgelati, serve motrice.",
    },
  });

  // -------------------------------------------------------------------------
  // PRESE SPOT per DOMANI
  // -------------------------------------------------------------------------
  console.log("📦 Creazione prese spot per domani...");
  const spotData = [
    {
      customer: customers[1], addrIdx: 0, status: "READY" as const, timeWindow: "MORNING" as const,
      pallets: 5, colli: 30, weightKg: 1200, priority: "NORMAL" as const,
      rawNotes: "Bancali EPAL da ritirare al mattino presto.",
    },
    {
      customer: customers[3], addrIdx: 0, status: "READY" as const, timeWindow: "AFTERNOON" as const,
      pallets: 3, priority: "HIGH" as const, requiresTailLift: true,
      rawNotes: "Cliente chiede ritiro pomeriggio.",
    },
    {
      // presa con dati mancanti (no pallets, no note)
      customer: customers[4], addrIdx: 0, status: "DRAFT" as const, timeWindow: "ANYTIME" as const,
      priority: "NORMAL" as const,
    },
    {
      customer: customers[5], addrIdx: 0, status: "READY" as const, timeWindow: "MORNING" as const,
      pallets: 8, weightKg: 3000, requiresMotrice: true, priority: "MANDATORY" as const,
      rawNotes: "Carico pesante, valutare motrice.",
    },
    {
      customer: customers[7], addrIdx: 0, status: "READY" as const, timeWindow: "ANYTIME" as const,
      pallets: 2, colli: 14, rawNotes: "Ortofrutta, ritiro flessibile.",
    },
    {
      customer: customers[9], addrIdx: 0, status: "READY" as const, timeWindow: "SPECIFIC" as const,
      timeFrom: "09:00", timeTo: "10:30", pallets: 4, rawNotes: "Finestra oraria stretta in mattinata.",
    },
  ];
  const createdSpot = [];
  for (const s of spotData) {
    const p = await prisma.pickup.create({
      data: {
        pickupDate: TOMORROW,
        customerId: s.customer.id,
        addressId: s.customer.addresses[s.addrIdx].id,
        sourceType: "SPOT",
        status: s.status,
        timeWindow: s.timeWindow,
        timeFrom: (s as { timeFrom?: string }).timeFrom,
        timeTo: (s as { timeTo?: string }).timeTo,
        pallets: (s as { pallets?: number }).pallets,
        colli: (s as { colli?: number }).colli,
        weightKg: (s as { weightKg?: number }).weightKg,
        requiresTailLift: (s as { requiresTailLift?: boolean }).requiresTailLift ?? false,
        requiresMotrice: (s as { requiresMotrice?: boolean }).requiresMotrice ?? false,
        priority: s.priority,
        rawNotes: (s as { rawNotes?: string }).rawNotes,
      },
    });
    createdSpot.push(p);
  }

  // -------------------------------------------------------------------------
  // GIRI DEMO — 2 giri per domani
  // -------------------------------------------------------------------------
  console.log("🗺️  Creazione giri demo...");
  // Giro 1 — mattina con furgone, 2 prese assegnate (-> PLANNED)
  const route1 = await prisma.route.create({
    data: {
      routeDate: TOMORROW,
      driverId: drivers[0].id,
      vehicleId: vehicles[0].id,
      shift: "MORNING",
      status: "DRAFT",
      notes: "Giro centro Milano.",
    },
  });
  await prisma.routeStop.create({ data: { routeId: route1.id, pickupId: createdSpot[0].id, sequence: 1 } });
  await prisma.routeStop.create({ data: { routeId: route1.id, pickupId: createdSpot[4].id, sequence: 2 } });
  await prisma.pickup.updateMany({
    where: { id: { in: [createdSpot[0].id, createdSpot[4].id] } },
    data: { status: "PLANNED" },
  });

  // Giro 2 — giornata intera con motrice, 1 presa pesante assegnata
  const route2 = await prisma.route.create({
    data: {
      routeDate: TOMORROW,
      driverId: drivers[2].id,
      vehicleId: vehicles[11].id, // Motrice 1
      shift: "FULL_DAY",
      status: "DRAFT",
      notes: "Giro provincia sud, carichi pesanti.",
    },
  });
  await prisma.routeStop.create({ data: { routeId: route2.id, pickupId: createdSpot[3].id, sequence: 1 } });
  await prisma.pickup.update({
    where: { id: createdSpot[3].id },
    data: { status: "PLANNED" },
  });

  console.log("✅ Seed completato.");
  console.log(`   Clienti: ${customers.length}`);
  console.log(`   Mezzi: ${vehicles.length} (2 motrici)`);
  console.log(`   Autisti: ${drivers.length}`);
  console.log(`   Prese spot domani: ${createdSpot.length}`);
  console.log(`   Giri demo: 2`);
}

main()
  .catch((e) => {
    console.error("❌ Errore nel seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
