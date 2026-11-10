const { calculateSignalTiming, calculateNetworkDecision } = require('../algorithms/trafficDecision');

// Simulated traffic conditions from project proposal (Section 3)
const defaultTrafficData = {
  north: 80,  // High (35s)
  south: 50,  // Medium (25s)
  east: 15,   // Low (15s)
  west: 100   // Very High (45s)
};

const defaultNetworkData = {
  J1: 80,
  J2: 50,
  J3: 15,
  J4: 100
};

/**
 * Controller to fetch current simulated traffic density
 * GET /api/traffic/current
 */
const getCurrentTraffic = (req, res) => {
  res.status(200).json({
    status: 'success',
    timestamp: new Date().toISOString(),
    directional: defaultTrafficData,
    network: defaultNetworkData
  });
};

/**
 * Controller to compute traffic light decision
 * GET /api/traffic/decision (evaluates current or query traffic)
 * POST /api/traffic/decision (evaluates custom traffic passed in request body)
 */
const getTrafficDecision = (req, res) => {
  // Check if request is for the 4-junction network (J1, J2, J3, J4)
  const isNetworkPayload = req.body?.vehicles || req.body?.J1 !== undefined || req.query?.J1 !== undefined;

  if (isNetworkPayload) {
    const vehicles = req.body?.vehicles || {
      J1: req.body?.J1 ?? req.query?.J1 ?? defaultNetworkData.J1,
      J2: req.body?.J2 ?? req.query?.J2 ?? defaultNetworkData.J2,
      J3: req.body?.J3 ?? req.query?.J3 ?? defaultNetworkData.J3,
      J4: req.body?.J4 ?? req.query?.J4 ?? defaultNetworkData.J4,
    };

    const decision = calculateNetworkDecision({
      vehicles,
      ambulance: req.body?.ambulance || null,
      currentGreen: req.body?.currentGreen || req.query?.currentGreen || null,
      isNextCycle: Boolean(req.body?.isNextCycle || req.query?.isNextCycle)
    });

    return res.status(200).json({
      status: 'success',
      server: 'Node.js Express (Port 3000)',
      connected: true,
      timestamp: new Date().toISOString(),
      ...decision
    });
  }

  // Directional calculation (North, South, East, West)
  const trafficData = {
    north: req.body?.north ?? req.query?.north ?? defaultTrafficData.north,
    south: req.body?.south ?? req.query?.south ?? defaultTrafficData.south,
    east: req.body?.east ?? req.query?.east ?? defaultTrafficData.east,
    west: req.body?.west ?? req.query?.west ?? defaultTrafficData.west,
    emergencyDirection: req.body?.emergencyDirection ?? req.query?.emergencyDirection ?? req.body?.emergency ?? req.query?.emergency,
    emergencyVehicleType: req.body?.emergencyVehicleType ?? req.query?.emergencyVehicleType
  };

  const decision = calculateSignalTiming(trafficData);

  return res.status(200).json({
    status: 'success',
    server: 'Node.js Express (Port 3000)',
    connected: true,
    timestamp: new Date().toISOString(),
    ...decision
  });
};

module.exports = {
  getCurrentTraffic,
  getTrafficDecision
};
