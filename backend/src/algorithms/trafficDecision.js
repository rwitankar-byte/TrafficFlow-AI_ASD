/**
 * Traffic Signal Decision Algorithm
 * Evaluates traffic density at an intersection and determines
 * which direction gets green light and for how long.
 */

const MIN_GREEN_TIME = 15; // Minimum green light duration (seconds)
const MAX_GREEN_TIME = 90; // Maximum green light duration (seconds)
const BASE_GREEN_TIME = 20; // Base green light duration (seconds)

/**
 * Calculates optimal green light direction and duration.
 * 
 * @param {Object} trafficData - Vehicle counts per direction
 * @param {number} trafficData.north - Number of vehicles from North
 * @param {number} trafficData.south - Number of vehicles from South
 * @param {number} trafficData.east - Number of vehicles from East
 * @param {number} trafficData.west - Number of vehicles from West
 * @returns {Object} { greenDirection: string, duration: number }
 */
function calculateSignalTiming(trafficData = {}) {
  const north = Number(trafficData.north) || 0;
  const south = Number(trafficData.south) || 0;
  const east = Number(trafficData.east) || 0;
  const west = Number(trafficData.west) || 0;

  // Group opposing lanes into traffic corridors
  const northSouthTotal = north + south;
  const eastWestTotal = east + west;

  let greenDirection = 'NORTH_SOUTH';
  let prioritizedVehicleCount = northSouthTotal;

  // More vehicles -> Higher priority
  if (eastWestTotal >= northSouthTotal) {
    greenDirection = 'EAST_WEST';
    prioritizedVehicleCount = eastWestTotal;
  }

  // Calculate dynamic green time:
  // Base time (20s) + 0.5s per vehicle in the winning corridor
  // E.g., for 50 vehicles: 20 + (50 * 0.5) = 45s
  const calculatedDuration = Math.round(BASE_GREEN_TIME + (prioritizedVehicleCount * 0.5));

  // Clamp within safe traffic limits [MIN_GREEN_TIME, MAX_GREEN_TIME]
  const duration = Math.min(Math.max(calculatedDuration, MIN_GREEN_TIME), MAX_GREEN_TIME);

  return {
    greenDirection,
    duration
  };
}

module.exports = {
  calculateSignalTiming,
  MIN_GREEN_TIME,
  MAX_GREEN_TIME,
  BASE_GREEN_TIME
};

