CREATE TYPE "Direction" AS ENUM ('NORTH', 'SOUTH', 'EAST', 'WEST');
CREATE TYPE "TrafficTier" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH');
CREATE TYPE "SignalState" AS ENUM ('RED', 'YELLOW', 'GREEN');
CREATE TYPE "DispatchStatus" AS ENUM ('ACTIVE', 'ARRIVED', 'CLEARED', 'CANCELLED');

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
CREATE TABLE "Hospital" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Hospital_pkey" PRIMARY KEY ("id")
);
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

CREATE UNIQUE INDEX "Junction_code_key" ON "Junction"("code");
CREATE INDEX "TrafficData_junctionId_idx" ON "TrafficData"("junctionId");
CREATE INDEX "TrafficData_capturedAt_idx" ON "TrafficData"("capturedAt");
CREATE INDEX "TrafficData_junctionId_capturedAt_idx" ON "TrafficData"("junctionId", "capturedAt");
CREATE INDEX "Signal_junctionId_idx" ON "Signal"("junctionId");
CREATE UNIQUE INDEX "Signal_junctionId_direction_key" ON "Signal"("junctionId", "direction");
CREATE INDEX "SignalLog_signalId_occurredAt_idx" ON "SignalLog"("signalId", "occurredAt");
CREATE INDEX "SignalLog_occurredAt_idx" ON "SignalLog"("occurredAt");
CREATE UNIQUE INDEX "Hospital_code_key" ON "Hospital"("code");
CREATE INDEX "EmergencyDispatch_status_startedAt_idx" ON "EmergencyDispatch"("status", "startedAt");
CREATE INDEX "EmergencyDispatch_startJunctionId_idx" ON "EmergencyDispatch"("startJunctionId");
CREATE INDEX "EmergencyDispatch_currentJunctionId_idx" ON "EmergencyDispatch"("currentJunctionId");

ALTER TABLE "TrafficData" ADD CONSTRAINT "TrafficData_junctionId_fkey" FOREIGN KEY ("junctionId") REFERENCES "Junction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Signal" ADD CONSTRAINT "Signal_junctionId_fkey" FOREIGN KEY ("junctionId") REFERENCES "Junction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SignalLog" ADD CONSTRAINT "SignalLog_signalId_fkey" FOREIGN KEY ("signalId") REFERENCES "Signal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmergencyDispatch" ADD CONSTRAINT "EmergencyDispatch_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmergencyDispatch" ADD CONSTRAINT "EmergencyDispatch_startJunctionId_fkey" FOREIGN KEY ("startJunctionId") REFERENCES "Junction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmergencyDispatch" ADD CONSTRAINT "EmergencyDispatch_currentJunctionId_fkey" FOREIGN KEY ("currentJunctionId") REFERENCES "Junction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
