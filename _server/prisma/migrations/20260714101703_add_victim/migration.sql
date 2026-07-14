-- CreateEnum
CREATE TYPE "VictimStatus" AS ENUM ('active', 'rescued');

-- CreateTable
CREATE TABLE "Victim" (
    "id" TEXT NOT NULL,
    "label" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "status" "VictimStatus" NOT NULL DEFAULT 'active',
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Victim_pkey" PRIMARY KEY ("id")
);
