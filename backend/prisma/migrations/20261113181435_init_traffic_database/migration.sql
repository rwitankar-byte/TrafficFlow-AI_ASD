-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('NORTH', 'SOUTH', 'EAST', 'WEST');

-- CreateEnum
CREATE TYPE "TrafficTier" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH');

-- CreateEnum
CREATE TYPE "SignalState" AS ENUM ('RED', 'YELLOW', 'GREEN');

-- CreateEnum
CREATE TYPE "DispatchStatus" AS ENUM ('ACTIVE', 'ARRIVED', 'CLEARED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Junction" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "mapX" INTEGER NOT NULL,
    "mapY" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Junction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrafficData" (
    "id" TEXT NOT NULL,
    "junctionId" TEXT NOT NULL,
    "direction" "Direction" NOT NULL,
    "vehicleCount" INTEGER NOT NULL,
    "trafficTier" "TrafficTier",
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT,

    CONSTRAINT "TrafficData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Signal" (
    "id" TEXT NOT NULL,
    "junctionId" TEXT NOT NULL,
    "direction" "Direction" NOT NULL,
    "state" "SignalState" NOT NULL DEFAULT 'RED',
    "greenDurationSec" INTEGER,
    "activeSince" TIMESTAMP(3),
    "isEmergency" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Signal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignalLog" (
    "id" TEXT NOT NULL,
    "signalId" TEXT NOT NULL,
    "previousState" "SignalState",
    "nextState" "SignalState" NOT NULL,
    "durationSec" INTEGER,
    "reason" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignalLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hospital" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Hospital_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyDispatch" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "startJunctionId" TEXT NOT NULL,
    "currentJunctionId" TEXT,
    "vehicleType" TEXT NOT NULL DEFAULT 'AMBULANCE',
    "route" JSONB NOT NULL,
    "status" "DispatchStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "arrivedAt" TIMESTAMP(3),
    "clearedAt" TIMESTAMP(3),

    CONSTRAINT "EmergencyDispatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Junction_code_key" ON "Junction"("code");

-- CreateIndex
CREATE INDEX "TrafficData_junctionId_idx" ON "TrafficData"("junctionId");

-- CreateIndex
CREATE INDEX "TrafficData_capturedAt_idx" ON "TrafficData"("capturedAt");

-- CreateIndex
CREATE INDEX "TrafficData_junctionId_capturedAt_idx" ON "TrafficData"("junctionId", "capturedAt");

-- CreateIndex
CREATE INDEX "Signal_junctionId_idx" ON "Signal"("junctionId");

-- CreateIndex
CREATE UNIQUE INDEX "Signal_junctionId_direction_key" ON "Signal"("junctionId", "direction");

-- CreateIndex
CREATE INDEX "SignalLog_signalId_occurredAt_idx" ON "SignalLog"("signalId", "occurredAt");

-- CreateIndex
CREATE INDEX "SignalLog_occurredAt_idx" ON "SignalLog"("occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "Hospital_code_key" ON "Hospital"("code");

-- CreateIndex
CREATE INDEX "EmergencyDispatch_status_startedAt_idx" ON "EmergencyDispatch"("status", "startedAt");

-- CreateIndex
CREATE INDEX "EmergencyDispatch_startJunctionId_idx" ON "EmergencyDispatch"("startJunctionId");

-- CreateIndex
CREATE INDEX "EmergencyDispatch_currentJunctionId_idx" ON "EmergencyDispatch"("currentJunctionId");

-- AddForeignKey
ALTER TABLE "TrafficData" ADD CONSTRAINT "TrafficData_junctionId_fkey" FOREIGN KEY ("junctionId") REFERENCES "Junction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signal" ADD CONSTRAINT "Signal_junctionId_fkey" FOREIGN KEY ("junctionId") REFERENCES "Junction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalLog" ADD CONSTRAINT "SignalLog_signalId_fkey" FOREIGN KEY ("signalId") REFERENCES "Signal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyDispatch" ADD CONSTRAINT "EmergencyDispatch_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyDispatch" ADD CONSTRAINT "EmergencyDispatch_startJunctionId_fkey" FOREIGN KEY ("startJunctionId") REFERENCES "Junction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyDispatch" ADD CONSTRAINT "EmergencyDispatch_currentJunctionId_fkey" FOREIGN KEY ("currentJunctionId") REFERENCES "Junction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
