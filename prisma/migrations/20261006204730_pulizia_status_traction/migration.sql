-- Pulizia finale (contract): rimuove il vecchio stato salvato delle prese e la
-- tabella delle trazioni, sostituiti da stato calcolato/cancelledAt e Carichi.
-- Applicata solo dopo il deploy del codice che non li usa, con backup verificato
-- (backups/2026-10-06T20-46-33_pre-pulizia-status-traction.dump).

-- Sicurezza: eventuali prese annullate col vecchio campo restano annullate.
UPDATE "Pickup" SET "cancelledAt" = "updatedAt" WHERE "status" = 'CANCELLED' AND "cancelledAt" IS NULL;

-- DropForeignKey
ALTER TABLE "Traction" DROP CONSTRAINT "Traction_branchId_fkey";

-- DropForeignKey
ALTER TABLE "Traction" DROP CONSTRAINT "Traction_driverId_fkey";

-- DropIndex
DROP INDEX "Pickup_status_idx";

-- AlterTable
ALTER TABLE "Pickup" DROP COLUMN "status";

-- DropTable
DROP TABLE "Traction";

-- DropEnum
DROP TYPE "PickupStatus";
