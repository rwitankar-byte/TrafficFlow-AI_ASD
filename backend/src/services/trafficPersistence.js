const { getPrisma } = require('../db/client.js');

const directions = ['north', 'south', 'east', 'west'];
const junctionCodes = ['J1', 'J2', 'J3', 'J4'];

function routeFor(startJunction) {
  if (startJunction === 'J1') return ['J1', 'J2', 'J4', 'HOSPITAL'];
  if (startJunction === 'J2') return ['J2', 'J4', 'HOSPITAL'];
  if (startJunction === 'J3') return ['J3', 'J4', 'HOSPITAL'];
  return [startJunction, 'HOSPITAL'];
}

function signalState(junctionDecision, direction) {
  return junctionDecision?.directions?.[direction]?.signal === 'GREEN' ? 'GREEN' : 'RED';
}

async function persistTrafficDecision({ networkVehicles, decision, source = 'api', prismaClient = getPrisma() }) {
  const capturedAt = new Date();
  return prismaClient.$transaction(async (tx) => {
    const junctions = await tx.junction.findMany({ where: { code: { in: junctionCodes } } });
    const byCode = new Map(junctions.map((junction) => [junction.code, junction]));

    for (const code of junctionCodes) {
      const junction = byCode.get(code);
      if (!junction) throw new Error(`Missing seeded junction: ${code}`);
      const counts = networkVehicles[code] || { north: 10, south: 10, east: 10, west: 10 };
      const junctionDecision = decision.junctions?.[code];

      await tx.trafficData.createMany({
        data: directions.map((direction) => ({
          junctionId: junction.id,
          direction: direction.toUpperCase(),
          vehicleCount: Number(counts[direction] ?? 0),
          trafficTier: junctionDecision?.directions?.[direction]?.level === 'VERY_HIGH'
            ? 'VERY_HIGH'
            : junctionDecision?.directions?.[direction]?.level || null,
          capturedAt,
          source
        }))
      });

      for (const direction of directions) {
        const directionUpper = direction.toUpperCase();
        const state = signalState(junctionDecision, direction);
        const isEmergency = Boolean(junctionDecision?.isEmergency && junctionDecision.activeDirection === directionUpper);
        const greenDurationSec = state === 'GREEN' ? junctionDecision.duration : null;
        const existing = await tx.signal.findUnique({
          where: { junctionId_direction: { junctionId: junction.id, direction: directionUpper } }
        });

        const changed = !existing || existing.state !== state || existing.greenDurationSec !== greenDurationSec || existing.isEmergency !== isEmergency;
        const signal = await tx.signal.upsert({
          where: { junctionId_direction: { junctionId: junction.id, direction: directionUpper } },
          create: {
            junctionId: junction.id,
            direction: directionUpper,
            state,
            greenDurationSec,
            activeSince: state === 'GREEN' ? capturedAt : null,
            isEmergency
          },
          update: {
            state,
            greenDurationSec,
            activeSince: state === 'GREEN' ? (existing?.state !== 'GREEN' ? capturedAt : existing.activeSince): null,
            isEmergency
          }
        });

        if (existing?.state !== state && junctionDecision) {
          await tx.signalLog.create({
            data: {
              signalId: signal.id,
              previousState: existing?.state || null,
              nextState: state,
              durationSec: greenDurationSec,
              reason: junctionDecision.message
            }
          });
        }
      }
    }
  });
}

async function persistEmergencyDispatch({ ambulance, prismaClient = getPrisma() }) {
  const hospital = await prismaClient.hospital.findUnique({ where: { code: 'HOSPITAL' } });
  if (!hospital) throw new Error('Missing seeded hospital: HOSPITAL');

  const active = await prismaClient.emergencyDispatch.findFirst({
    where: { status: { in: ['ACTIVE', 'ARRIVED'] } },
    orderBy: { startedAt: 'desc' }
  });

  if (!ambulance) {
    if (active) {
      return prismaClient.emergencyDispatch.update({
        where: { id: active.id },
        data: { status: 'CLEARED', clearedAt: new Date() }
      });
    }
    return null;
  }

  const currentCode = ambulance.currentJunction || ambulance.junction;
  const currentJunction = ['J1', 'J2', 'J3', 'J4'].includes(currentCode)
    ? await prismaClient.junction.findUnique({ where: { code: currentCode } })
    : null;
  const arrived = currentCode === 'HOSPITAL' || Number(ambulance.progress || 0) >= 100;
  const status = arrived ? 'ARRIVED' : 'ACTIVE';
  const data = {
    currentJunctionId: currentJunction?.id || null,
    status,
    arrivedAt: arrived ? new Date() : null
  };

  if (active) return prismaClient.emergencyDispatch.update({ where: { id: active.id }, data });

  const startJunction = await prismaClient.junction.findUnique({ where: { code: ambulance.junction } });
  if (!startJunction) throw new Error('Invalid ambulance start junction');
  return prismaClient.emergencyDispatch.create({
    data: {
      hospitalId: hospital.id,
      startJunctionId: startJunction.id,
      ...data,
      vehicleType: 'AMBULANCE',
      route: ambulance.path || routeFor(ambulance.junction)
    }
  });
}

module.exports = { persistTrafficDecision, persistEmergencyDispatch, routeFor };
