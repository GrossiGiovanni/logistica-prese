-- Priorità 2 + trazioni dai Carichi.
-- Solo aggiunte: nessuna colonna, tabella o dato viene rimosso. Gli unici
-- DROP INDEX sostituiscono vecchi indici con vincoli più severi, creati PRIMA
-- (se ci fossero duplicati la migrazione fallirebbe senza aver tolto nulla).

-- 1) Stato presa calcolato: l'annullamento diventa l'unico stato persistito.
ALTER TABLE "Pickup" ADD COLUMN "cancelledAt" TIMESTAMP(3);
CREATE INDEX "Pickup_cancelledAt_idx" ON "Pickup"("cancelledAt");
-- Backfill: le prese già annullate restano annullate.
UPDATE "Pickup" SET "cancelledAt" = "updatedAt" WHERE "status" = 'CANCELLED' AND "cancelledAt" IS NULL;

-- 2) Una presa (o un reso) in UN SOLO giro.
CREATE UNIQUE INDEX "RouteStop_pickupId_key" ON "RouteStop"("pickupId");
CREATE UNIQUE INDEX "RouteStop_resoId_key" ON "RouteStop"("resoId");
DROP INDEX "RouteStop_pickupId_idx";
DROP INDEX "RouteStop_resoId_idx";
DROP INDEX "RouteStop_routeId_pickupId_key";
DROP INDEX "RouteStop_routeId_resoId_key";

-- 3) Trazioni gestite solo dai Carichi: autista Eurosarda sul carico e flag
--    "Vettore Eurosarda" in anagrafica trazionisti (→ Costo Industriale).
ALTER TABLE "Carico" ADD COLUMN "driverId" TEXT;
CREATE INDEX "Carico_driverId_idx" ON "Carico"("driverId");
ALTER TABLE "Carico" ADD CONSTRAINT "Carico_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Trazionista" ADD COLUMN "isEurosarda" BOOLEAN NOT NULL DEFAULT false;
-- Configurazione iniziale (poi modificabile da Anagrafica → Trazionisti):
-- il vettore "EUROSARDA" già in anagrafica è quello dei carichi Eurosarda.
UPDATE "Trazionista" SET "isEurosarda" = true WHERE UPPER(TRIM("name")) = 'EUROSARDA';
