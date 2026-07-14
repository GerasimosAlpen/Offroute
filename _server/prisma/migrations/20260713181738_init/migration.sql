-- CreateEnum
CREATE TYPE "HazardKind" AS ENUM ('fire', 'blocked', 'medical', 'crash', 'theft');

-- CreateEnum
CREATE TYPE "HazardSeverity" AS ENUM ('critical', 'warning', 'info');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('enroute', 'arrived');

-- CreateEnum
CREATE TYPE "FlareStatus" AS ENUM ('active', 'calm');

-- CreateTable
CREATE TABLE "Personnel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "callsign" TEXT NOT NULL,
    "offsetLat" DOUBLE PRECISION NOT NULL,
    "offsetLon" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Personnel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "kind" "HazardKind" NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "HazardSeverity" NOT NULL,
    "offsetLat" DOUBLE PRECISION NOT NULL,
    "offsetLon" DOUBLE PRECISION NOT NULL,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "hazardId" TEXT NOT NULL,
    "rangerId" TEXT NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'enroute',
    "unitLat" DOUBLE PRECISION NOT NULL,
    "unitLon" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResolvedHazard" (
    "id" TEXT NOT NULL,
    "hazardId" TEXT NOT NULL,
    "rangerId" TEXT NOT NULL,
    "rangerName" TEXT NOT NULL,
    "callsign" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResolvedHazard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessagePin" (
    "id" TEXT NOT NULL,
    "rangerId" TEXT NOT NULL,
    "rangerName" TEXT NOT NULL,
    "callsign" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessagePin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommsEntry" (
    "id" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "lead" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommsEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvacuationPoint" (
    "id" TEXT NOT NULL,
    "rangerId" TEXT NOT NULL,
    "rangerName" TEXT NOT NULL,
    "callsign" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvacuationPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvacuationRequest" (
    "id" TEXT NOT NULL,
    "rangerId" TEXT NOT NULL,
    "rangerName" TEXT NOT NULL,
    "callsign" TEXT NOT NULL,
    "atLat" DOUBLE PRECISION NOT NULL,
    "atLon" DOUBLE PRECISION NOT NULL,
    "incidentLat" DOUBLE PRECISION NOT NULL,
    "incidentLon" DOUBLE PRECISION NOT NULL,
    "accepted" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvacuationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlareAlert" (
    "id" TEXT NOT NULL,
    "status" "FlareStatus" NOT NULL DEFAULT 'active',
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlareAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlareDispatch" (
    "id" TEXT NOT NULL,
    "flareId" TEXT NOT NULL,
    "rangerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlareDispatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ResolvedHazard_hazardId_key" ON "ResolvedHazard"("hazardId");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_hazardId_fkey" FOREIGN KEY ("hazardId") REFERENCES "Incident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_rangerId_fkey" FOREIGN KEY ("rangerId") REFERENCES "Personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResolvedHazard" ADD CONSTRAINT "ResolvedHazard_hazardId_fkey" FOREIGN KEY ("hazardId") REFERENCES "Incident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResolvedHazard" ADD CONSTRAINT "ResolvedHazard_rangerId_fkey" FOREIGN KEY ("rangerId") REFERENCES "Personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessagePin" ADD CONSTRAINT "MessagePin_rangerId_fkey" FOREIGN KEY ("rangerId") REFERENCES "Personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvacuationPoint" ADD CONSTRAINT "EvacuationPoint_rangerId_fkey" FOREIGN KEY ("rangerId") REFERENCES "Personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlareDispatch" ADD CONSTRAINT "FlareDispatch_flareId_fkey" FOREIGN KEY ("flareId") REFERENCES "FlareAlert"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlareDispatch" ADD CONSTRAINT "FlareDispatch_rangerId_fkey" FOREIGN KEY ("rangerId") REFERENCES "Personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
