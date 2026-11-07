const { calculateSignalTiming } = require('../algorithms/trafficDecision');

// Simulated traffic conditions from project proposal (Section 3)
const defaultTrafficData = {
  north: 80,  // High (35s)
  south: 50,  // Medium (25s)
  east: 15,   // Low (15s)
  west: 100   // Very High (45s)
};

/**
 * Controller to fetch current simulated traffic density
 * GET /api/traffic/current
 */
const getCurrentTraffic = (req, res) => {
  res.status(200).json(defaultTrafficData);
};

/**
 * Controller to compute traffic light decision
 * GET /api/traffic/decision (evaluates current or query traffic)
 * POST /api/traffic/decision (evaluates custom traffic passed in request body)
 */
const getTrafficDecision = (req, res) => {
  // Read traffic counts from body (POST), query parameters (GET), or default simulation
  const trafficData = {
    north: req.body?.north ?? req.query?.north ?? defaultTrafficData.north,
    south: req.body?.south ?? req.query?.south ?? defaultTrafficData.south,
    east: req.body?.east ?? req.query?.east ?? defaultTrafficData.east,
    west: req.body?.west ?? req.query?.west ?? defaultTrafficData.west,
    emergencyDirection: req.body?.emergencyDirection ?? req.query?.emergencyDirection ?? req.body?.emergency ?? req.query?.emergency,
    emergencyVehicleType: req.body?.emergencyVehicleType ?? req.query?.emergencyVehicleType
  };

  const decision = calculateSignalTiming(trafficData);

  res.status(200).json(decision);
};

module.exports = {
  getCurrentTraffic,
  getTrafficDecision
};
