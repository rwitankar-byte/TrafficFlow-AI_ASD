const { 
  calculate16SignalNetworkDecision, 
  evaluateSingleJunction 
} = require('../algorithms/trafficDecision');

// Initial default vehicle counts for all 16 directional approaches
// 4 Junctions x 4 Directions (North, South, East, West)
const defaultNetworkTraffic = {
  J1: { north: 25, south: 20, east: 15, west: 20 }, // Grand Ave (Total: 80)
  J2: { north: 15, south: 10, east: 15, west: 10 }, // Metro Blvd (Total: 50)
  J3: { north: 5,  south: 4,  east: 3,  west: 3  }, // Outer Ring (Total: 15)
  J4: { north: 30, south: 25, east: 15, west: 30 }  // Expressway (Total: 100)
};

/**
 * Fetch initial 16-signal traffic data
 * GET /api/traffic/current
 */
const getCurrentTraffic = (req, res) => {
  res.status(200).json({
    status: 'success',
    server: 'Node.js Express (Port 3000)',
    totalSignals: 16,
    defaultVehicles: defaultNetworkTraffic
  });
};

/**
 * Controller to compute decisions for all 16 signals (or individual junction)
 * GET & POST /api/traffic/decision
 */
const getTrafficDecision = (req, res) => {
  const payload = req.body || {};

  // Check if request is for the 16-signal network (J1, J2, J3, J4 with directional counts)
  const networkVehicles = payload.networkVehicles || payload.vehicles || defaultNetworkTraffic;

  // Support single junction directional query (north, south, east, west)
  if (payload.north !== undefined || req.query?.north !== undefined) {
    const singleCounts = {
      north: payload.north ?? req.query?.north ?? 20,
      south: payload.south ?? req.query?.south ?? 15,
      east: payload.east ?? req.query?.east ?? 40,
      west: payload.west ?? req.query?.west ?? 10
    };
    const decision = evaluateSingleJunction(singleCounts, payload.emergency || req.query?.emergency || null);
    return res.status(200).json({
      status: 'success',
      server: 'Node.js Express (Port 3000)',
      connected: true,
      ...decision
    });
  }

  // Full 16-signal multi-junction decision calculation
  const decision = calculate16SignalNetworkDecision({
    networkVehicles,
    ambulance: payload.ambulance || null,
    activeSignals: payload.activeSignals || {},
    rotatingJunction: payload.rotatingJunction || null
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
