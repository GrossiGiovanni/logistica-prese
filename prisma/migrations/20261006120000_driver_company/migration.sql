-- Azienda dell'autista (Eurosarda / Rama / Omar / altro) per la ripartizione costi.
-- Solo aggiunte: nessuna colonna o dato esistente viene rimosso.

-- CreateEnum
CREATE TYPE "public"."DriverCompany" AS ENUM ('EUROSARDA', 'RAMA', 'OMAR', 'ALTRO');

-- AlterTable
ALTER TABLE "public"."Driver" ADD COLUMN "company" "public"."DriverCompany" NOT NULL DEFAULT 'ALTRO';

-- Backfill: autisti col flag Eurosarda -> EUROSARDA; gli altri dal titolare del
-- mezzo predefinito (RA.MA. / OMAR). I restanti restano ALTRO e vanno
-- verificati in anagrafica (il report li mostra come "non classificati").
UPDATE "public"."Driver" SET "company" = 'EUROSARDA' WHERE "isEurosarda" = true;

UPDATE "public"."Driver" d
SET "company" = 'RAMA'
FROM "public"."Vehicle" v
WHERE d."defaultVehicleId" = v."id"
  AND d."isEurosarda" = false
  AND REPLACE(REPLACE(UPPER(COALESCE(v."owner", '')), '.', ''), ' ', '') LIKE '%RAMA%';

UPDATE "public"."Driver" d
SET "company" = 'OMAR'
FROM "public"."Vehicle" v
WHERE d."defaultVehicleId" = v."id"
  AND d."isEurosarda" = false
  AND UPPER(COALESCE(v."owner", '')) LIKE '%OMAR%';
