-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."CostLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "public"."PickupSourceType" AS ENUM ('SPOT', 'RECURRING');

-- CreateEnum
CREATE TYPE "public"."PickupStatus" AS ENUM ('DRAFT', 'READY', 'PLANNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."Priority" AS ENUM ('NORMAL', 'HIGH', 'MANDATORY');

-- CreateEnum
CREATE TYPE "public"."RouteShift" AS ENUM ('MORNING', 'AFTERNOON', 'FULL_DAY');

-- CreateEnum
CREATE TYPE "public"."RouteStatus" AS ENUM ('DRAFT', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "public"."TimeWindow" AS ENUM ('MORNING', 'AFTERNOON', 'ANYTIME', 'SPECIFIC');

-- CreateEnum
CREATE TYPE "public"."VehicleType" AS ENUM ('VAN', 'TRUCK', 'MOTRICE', 'BILICO');

-- CreateTable
CREATE TABLE "public"."Address" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "label" TEXT,
    "street" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "postalCode" TEXT,
    "country" TEXT NOT NULL DEFAULT 'IT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Branch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Carico" (
    "id" TEXT NOT NULL,
    "branchId" TEXT,
    "loadDate" DATE NOT NULL,
    "carrier" TEXT NOT NULL,
    "plate" TEXT,
    "destination" TEXT,
    "reference" TEXT,
    "pallets" INTEGER,
    "colli" INTEGER,
    "weightKg" DOUBLE PRECISION,
    "volumeM3" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "nolo" DOUBLE PRECISION,
    "trazionistaId" TEXT,

    CONSTRAINT "Carico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vatNumber" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "branchId" TEXT,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Driver" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "defaultVehicleId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "code" TEXT,
    "whatsappEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isEurosarda" BOOLEAN NOT NULL DEFAULT false,
    "branchId" TEXT,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ImportLog" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "imported" INTEGER NOT NULL,
    "skipped" INTEGER NOT NULL,
    "errors" INTEGER NOT NULL,
    "errorDetails" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "branchId" TEXT,

    CONSTRAINT "ImportLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Pickup" (
    "id" TEXT NOT NULL,
    "pickupDate" DATE NOT NULL,
    "customerId" TEXT NOT NULL,
    "addressId" TEXT NOT NULL,
    "sourceType" "public"."PickupSourceType" NOT NULL DEFAULT 'SPOT',
    "status" "public"."PickupStatus" NOT NULL DEFAULT 'DRAFT',
    "timeWindow" "public"."TimeWindow" NOT NULL DEFAULT 'ANYTIME',
    "timeFrom" TEXT,
    "timeTo" TEXT,
    "pallets" INTEGER,
    "colli" INTEGER,
    "weightKg" DOUBLE PRECISION,
    "volumeM3" DOUBLE PRECISION,
    "requiresTailLift" BOOLEAN NOT NULL DEFAULT false,
    "requiresMotrice" BOOLEAN NOT NULL DEFAULT false,
    "priority" "public"."Priority" NOT NULL DEFAULT 'NORMAL',
    "rawNotes" TEXT,
    "internalNotes" TEXT,
    "recurringPickupId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "destination" TEXT,
    "loadingMeters" DOUBLE PRECISION,
    "pickupNumber" TEXT,
    "branchId" TEXT,
    "taxableVolumeM3" DOUBLE PRECISION,

    CONSTRAINT "Pickup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RecurringPickup" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "addressId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "monday" BOOLEAN NOT NULL DEFAULT false,
    "tuesday" BOOLEAN NOT NULL DEFAULT false,
    "wednesday" BOOLEAN NOT NULL DEFAULT false,
    "thursday" BOOLEAN NOT NULL DEFAULT false,
    "friday" BOOLEAN NOT NULL DEFAULT false,
    "saturday" BOOLEAN NOT NULL DEFAULT false,
    "sunday" BOOLEAN NOT NULL DEFAULT false,
    "defaultTimeWindow" "public"."TimeWindow" NOT NULL DEFAULT 'ANYTIME',
    "defaultTimeFrom" TEXT,
    "defaultTimeTo" TEXT,
    "defaultPallets" INTEGER,
    "defaultColli" INTEGER,
    "defaultWeightKg" DOUBLE PRECISION,
    "defaultVolumeM3" DOUBLE PRECISION,
    "defaultRequiresTailLift" BOOLEAN NOT NULL DEFAULT false,
    "defaultRequiresMotrice" BOOLEAN NOT NULL DEFAULT false,
    "defaultPriority" "public"."Priority" NOT NULL DEFAULT 'NORMAL',
    "defaultNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "branchId" TEXT,

    CONSTRAINT "RecurringPickup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Reso" (
    "id" TEXT NOT NULL,
    "distintaNumber" TEXT,
    "resoDate" DATE NOT NULL,
    "customerId" TEXT NOT NULL,
    "addressId" TEXT,
    "resiCount" INTEGER,
    "pallets" INTEGER,
    "colli" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "volumeM3" DOUBLE PRECISION,
    "weightKg" DOUBLE PRECISION,
    "branchId" TEXT,

    CONSTRAINT "Reso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Route" (
    "id" TEXT NOT NULL,
    "routeDate" DATE NOT NULL,
    "driverId" TEXT,
    "vehicleId" TEXT,
    "shift" "public"."RouteShift" NOT NULL DEFAULT 'FULL_DAY',
    "status" "public"."RouteStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "departureTime" TEXT,
    "km" DOUBLE PRECISION,
    "returnTime" TEXT,
    "lastWhatsappSentAt" TIMESTAMP(3),
    "branchId" TEXT,

    CONSTRAINT "Route_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RouteStop" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "pickupId" TEXT,
    "sequence" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resoId" TEXT,

    CONSTRAINT "RouteStop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Traction" (
    "id" TEXT NOT NULL,
    "tractionDate" DATE NOT NULL,
    "plate" TEXT,
    "driverId" TEXT,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "km" DOUBLE PRECISION,
    "cost" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "branchId" TEXT,

    CONSTRAINT "Traction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TrailerLog" (
    "id" TEXT NOT NULL,
    "logDate" DATE NOT NULL,
    "driverId" TEXT NOT NULL,
    "trailerPlate" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "branchId" TEXT,

    CONSTRAINT "TrailerLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Trazionista" (
    "id" TEXT NOT NULL,
    "branchId" TEXT,
    "name" TEXT NOT NULL,
    "defaultCost" DOUBLE PRECISION,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trazionista_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Vehicle" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "plate" TEXT,
    "vehicleType" "public"."VehicleType" NOT NULL DEFAULT 'BILICO',
    "capacityPallets" INTEGER,
    "hasTailLift" BOOLEAN NOT NULL DEFAULT false,
    "costLevel" "public"."CostLevel" NOT NULL DEFAULT 'MEDIUM',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "capacityVolumeM3" DOUBLE PRECISION,
    "capacityWeightKg" DOUBLE PRECISION,
    "costPerKm" DOUBLE PRECISION,
    "dailyCost" DOUBLE PRECISION,
    "owner" TEXT,
    "availability" "public"."RouteShift" NOT NULL DEFAULT 'FULL_DAY',
    "branchId" TEXT,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Address_city_idx" ON "public"."Address"("city" ASC);

-- CreateIndex
CREATE INDEX "Address_customerId_idx" ON "public"."Address"("customerId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Branch_code_key" ON "public"."Branch"("code" ASC);

-- CreateIndex
CREATE INDEX "Carico_branchId_idx" ON "public"."Carico"("branchId" ASC);

-- CreateIndex
CREATE INDEX "Carico_loadDate_idx" ON "public"."Carico"("loadDate" ASC);

-- CreateIndex
CREATE INDEX "Customer_branchId_idx" ON "public"."Customer"("branchId" ASC);

-- CreateIndex
CREATE INDEX "Customer_name_idx" ON "public"."Customer"("name" ASC);

-- CreateIndex
CREATE INDEX "Driver_active_idx" ON "public"."Driver"("active" ASC);

-- CreateIndex
CREATE INDEX "Driver_branchId_idx" ON "public"."Driver"("branchId" ASC);

-- CreateIndex
CREATE INDEX "ImportLog_createdAt_idx" ON "public"."ImportLog"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "Pickup_branchId_idx" ON "public"."Pickup"("branchId" ASC);

-- CreateIndex
CREATE INDEX "Pickup_customerId_idx" ON "public"."Pickup"("customerId" ASC);

-- CreateIndex
CREATE INDEX "Pickup_pickupDate_idx" ON "public"."Pickup"("pickupDate" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Pickup_pickupDate_recurringPickupId_key" ON "public"."Pickup"("pickupDate" ASC, "recurringPickupId" ASC);

-- CreateIndex
CREATE INDEX "Pickup_pickupNumber_idx" ON "public"."Pickup"("pickupNumber" ASC);

-- CreateIndex
CREATE INDEX "Pickup_sourceType_idx" ON "public"."Pickup"("sourceType" ASC);

-- CreateIndex
CREATE INDEX "Pickup_status_idx" ON "public"."Pickup"("status" ASC);

-- CreateIndex
CREATE INDEX "RecurringPickup_active_idx" ON "public"."RecurringPickup"("active" ASC);

-- CreateIndex
CREATE INDEX "RecurringPickup_customerId_idx" ON "public"."RecurringPickup"("customerId" ASC);

-- CreateIndex
CREATE INDEX "Reso_branchId_idx" ON "public"."Reso"("branchId" ASC);

-- CreateIndex
CREATE INDEX "Reso_customerId_idx" ON "public"."Reso"("customerId" ASC);

-- CreateIndex
CREATE INDEX "Reso_resoDate_idx" ON "public"."Reso"("resoDate" ASC);

-- CreateIndex
CREATE INDEX "Route_branchId_idx" ON "public"."Route"("branchId" ASC);

-- CreateIndex
CREATE INDEX "Route_routeDate_idx" ON "public"."Route"("routeDate" ASC);

-- CreateIndex
CREATE INDEX "Route_status_idx" ON "public"."Route"("status" ASC);

-- CreateIndex
CREATE INDEX "RouteStop_pickupId_idx" ON "public"."RouteStop"("pickupId" ASC);

-- CreateIndex
CREATE INDEX "RouteStop_resoId_idx" ON "public"."RouteStop"("resoId" ASC);

-- CreateIndex
CREATE INDEX "RouteStop_routeId_idx" ON "public"."RouteStop"("routeId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "RouteStop_routeId_pickupId_key" ON "public"."RouteStop"("routeId" ASC, "pickupId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "RouteStop_routeId_resoId_key" ON "public"."RouteStop"("routeId" ASC, "resoId" ASC);

-- CreateIndex
CREATE INDEX "Traction_branchId_idx" ON "public"."Traction"("branchId" ASC);

-- CreateIndex
CREATE INDEX "Traction_driverId_idx" ON "public"."Traction"("driverId" ASC);

-- CreateIndex
CREATE INDEX "Traction_tractionDate_idx" ON "public"."Traction"("tractionDate" ASC);

-- CreateIndex
CREATE INDEX "TrailerLog_driverId_idx" ON "public"."TrailerLog"("driverId" ASC);

-- CreateIndex
CREATE INDEX "TrailerLog_logDate_idx" ON "public"."TrailerLog"("logDate" ASC);

-- CreateIndex
CREATE INDEX "Trazionista_branchId_idx" ON "public"."Trazionista"("branchId" ASC);

-- CreateIndex
CREATE INDEX "Trazionista_name_idx" ON "public"."Trazionista"("name" ASC);

-- CreateIndex
CREATE INDEX "Vehicle_active_idx" ON "public"."Vehicle"("active" ASC);

-- CreateIndex
CREATE INDEX "Vehicle_branchId_idx" ON "public"."Vehicle"("branchId" ASC);

-- CreateIndex
CREATE INDEX "Vehicle_vehicleType_idx" ON "public"."Vehicle"("vehicleType" ASC);

-- AddForeignKey
ALTER TABLE "public"."Address" ADD CONSTRAINT "Address_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Carico" ADD CONSTRAINT "Carico_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Carico" ADD CONSTRAINT "Carico_trazionistaId_fkey" FOREIGN KEY ("trazionistaId") REFERENCES "public"."Trazionista"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Customer" ADD CONSTRAINT "Customer_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Driver" ADD CONSTRAINT "Driver_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Driver" ADD CONSTRAINT "Driver_defaultVehicleId_fkey" FOREIGN KEY ("defaultVehicleId") REFERENCES "public"."Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ImportLog" ADD CONSTRAINT "ImportLog_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Pickup" ADD CONSTRAINT "Pickup_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "public"."Address"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Pickup" ADD CONSTRAINT "Pickup_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Pickup" ADD CONSTRAINT "Pickup_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Pickup" ADD CONSTRAINT "Pickup_recurringPickupId_fkey" FOREIGN KEY ("recurringPickupId") REFERENCES "public"."RecurringPickup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RecurringPickup" ADD CONSTRAINT "RecurringPickup_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "public"."Address"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RecurringPickup" ADD CONSTRAINT "RecurringPickup_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RecurringPickup" ADD CONSTRAINT "RecurringPickup_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Reso" ADD CONSTRAINT "Reso_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "public"."Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Reso" ADD CONSTRAINT "Reso_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Reso" ADD CONSTRAINT "Reso_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Route" ADD CONSTRAINT "Route_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Route" ADD CONSTRAINT "Route_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Route" ADD CONSTRAINT "Route_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "public"."Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RouteStop" ADD CONSTRAINT "RouteStop_pickupId_fkey" FOREIGN KEY ("pickupId") REFERENCES "public"."Pickup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RouteStop" ADD CONSTRAINT "RouteStop_resoId_fkey" FOREIGN KEY ("resoId") REFERENCES "public"."Reso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RouteStop" ADD CONSTRAINT "RouteStop_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "public"."Route"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Traction" ADD CONSTRAINT "Traction_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Traction" ADD CONSTRAINT "Traction_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TrailerLog" ADD CONSTRAINT "TrailerLog_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TrailerLog" ADD CONSTRAINT "TrailerLog_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Trazionista" ADD CONSTRAINT "Trazionista_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Vehicle" ADD CONSTRAINT "Vehicle_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

