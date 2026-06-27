// Geocoding massivo degli indirizzi esistenti privi di coordinate.
// Best-effort: salta gli indirizzi non geocodificabili e li elenca a fine run.
//
// Prerequisito: GOOGLE_MAPS_API_KEY impostata in .env (Geocoding API abilitata).
// Esecuzione: npx tsx prisma/geocode-addresses.ts
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { geocodeAddress } from "../src/lib/geocode";

const prisma = new PrismaClient();

// Throttle gentile per rispettare i rate limit della Geocoding API.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!process.env.GOOGLE_MAPS_API_KEY) {
    console.error("GOOGLE_MAPS_API_KEY non impostata in .env — interrompo.");
    process.exit(1);
  }

  const addresses = await prisma.address.findMany({
    where: { OR: [{ lat: null }, { lng: null }] },
  });
  console.log(`Indirizzi da geocodificare: ${addresses.length}`);

  let ok = 0;
  const failed: string[] = [];

  for (const a of addresses) {
    const coords = await geocodeAddress(a);
    if (coords) {
      await prisma.address.update({
        where: { id: a.id },
        data: { lat: coords.lat, lng: coords.lng },
      });
      ok++;
      console.log(`  OK  ${a.street}, ${a.city} -> ${coords.lat}, ${coords.lng}`);
    } else {
      failed.push(`${a.street}, ${a.city} (${a.province})`);
      console.log(`  --  ${a.street}, ${a.city} (nessun risultato)`);
    }
    await sleep(150);
  }

  console.log(`\nCompletato. Geocodificati: ${ok}/${addresses.length}`);
  if (failed.length) {
    console.log("Da verificare manualmente:");
    failed.forEach((f) => console.log(`  - ${f}`));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
