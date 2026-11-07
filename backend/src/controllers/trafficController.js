const { calculateSignalTiming } = require('../algorithms/trafficDecision');

// Default simulated current traffic
const defaultTrafficData = {
  north: 20,
  south: 15,
  east: 40,
  west: 10
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
  // Read traffic from body (POST), query parameters (GET), or fallback to current traffic
  const trafficData = {
    north: req.body?.north ?? req.query?.north ?? defaultTrafficData.north,
    south: req.body?.south ?? req.query?.south ?? defaultTrafficData.south,
    east: req.body?.east ?? req.query?.east ?? defaultTrafficData.east,
    west: req.body?.west ?? req.query?.west ?? defaultTrafficData.west
  };

  const decision = calculateSignalTiming(trafficData);

  res.status(200).json(decision);
};

module.exports = {
  getCurrentTraffic,
  getTrafficDecision
};
