/**
 * Controller to fetch current simulated traffic density
 * GET /api/traffic/current
 */
const getCurrentTraffic = (req, res) => {
  const trafficData = {
    north: 20,
    south: 15,
    east: 40,
    west: 10
  };

  res.status(200).json(trafficData);
};

module.exports = {
  getCurrentTraffic
};

