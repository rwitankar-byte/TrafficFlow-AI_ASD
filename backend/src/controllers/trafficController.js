
const {
  calculate16SignalNetworkDecision,
  evaluateSingleJunction,
  evaluateSafeIntersection,
  SAFE_PHASES,
  SIGNAL_CONFIG,
  PRIORITY_WEIGHTS,
  MAX_WAIT_TIME
} = require('../algorithms/trafficDecision');

const { validateTrafficPayload, validateVehicleCount } = require('./trafficValidation.js');
const { getPrisma } = require('../db/client.js');
const {
  persistEmergencyDispatch,
  persistTrafficDecision
} = require('../services/trafficPersistence.js');

// Initial default vehicle counts for all 16 directional approaches
const defaultNetworkTraffic = {
  J1: { north: 25, south: 20, east: 15, west: 20 },
  J2: { north: 15, south: 10, east: 15, west: 10 },
  J3: { north: 5, south: 4, east: 3, west: 3 },
  J4: { north: 30, south: 25, east: 15, west: 30 }
};

/**
 * Fetch initial 16-signal traffic data
 * GET /api/traffic/current
 */
const getCurrentTraffic = async (req, res) => {
  const prisma = getPrisma();

  const junctions = await prisma.junction.findMany({
    orderBy: { code: 'asc' },
    include: { signals: true }
  });

  const defaultVehicles = structuredClone(defaultNetworkTraffic);

  const latest = await prisma.trafficData.findMany({
    orderBy: { capturedAt: 'desc' },
    take: 64
  });

  const seen = new Set();

  for (const row of latest) {
    const direction = row.direction.toLowerCase();
    const key = `${row.junctionId}:${direction}`;

    if (seen.has(key)) continue;

    const junction = junctions.find(
      (item) => item.id === row.junctionId
    );

    if (junction) {
      defaultVehicles[junction.code][direction] = row.vehicleCount;
      seen.add(key);
    }
  }

  res.status(200).json({
    status: 'success',
    server: 'Node.js Express (Port 3000)',
    totalSignals: 16,
    defaultVehicles,
    junctions,
    safePhases: SAFE_PHASES,
    signalConfig: SIGNAL_CONFIG
  });
};

/**
 * GET & POST /api/traffic/decision
 */
const getTrafficDecision = async (req, res) => {
  const payload = req.body || {};

  validateTrafficPayload(payload);

  const directions = ['north', 'south', 'east', 'west'];

  const isSingleIntersection =
    payload.trafficData !== undefined ||
    directions.some(
      (direction) =>
        payload[direction] !== undefined ||
        req.query?.[direction] !== undefined
    );

  // Single 4-way safe intersection decision
  if (isSingleIntersection) {
    const trafficData = payload.trafficData || {};

    for (const direction of directions) {
      const value =
        trafficData[direction] ??
        payload[direction] ??
        req.query?.[direction];

      if (value !== undefined) {
        validateVehicleCount(value);
        trafficData[direction] = Number(value);
      } else if (payload.trafficData === undefined) {
        trafficData[direction] =
          { north: 20, south: 15, east: 40, west: 10 }[direction];
      }
    }

    const emergency =
      payload.emergency ||
      payload.emergencyVehicle ||
      req.query?.emergency ||
      null;

    const decision = evaluateSafeIntersection({
      trafficData,
      currentPhase: payload.currentPhase || 'NORTH_SOUTH',
      currentSignalState: payload.currentSignalState || 'GREEN',
      emergency
    });

    return res.status(200).json({
      status: 'success',
      server: 'Node.js Express (Port 3000)',
      connected: true,
      ...decision
    });
  }

  // Full 16-signal multi-junction decision
  const networkVehicles =
    payload.networkVehicles ||
    payload.vehicles ||
    defaultNetworkTraffic;

  const decision = calculate16SignalNetworkDecision({
    networkVehicles,
    ambulance: payload.ambulance || null,
    activeSignals: payload.activeSignals || {},
    rotatingJunction: payload.rotatingJunction || null
  });

  // Persist traffic and emergency data
  await persistTrafficDecision({
    networkVehicles,
    decision,
    source: 'api'
  });

  await persistEmergencyDispatch({
    ambulance: payload.ambulance || null
  });

  return res.status(200).json({
    ...decision,
    server: 'Node.js Express (Port 3000)',
    connected: true
  });
};

module.exports = {
  getCurrentTraffic,
  getTrafficDecision,
  defaultNetworkTraffic
};
