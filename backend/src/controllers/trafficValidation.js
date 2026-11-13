const JUNCTIONS = ['J1', 'J2', 'J3', 'J4'];
const DIRECTIONS = ['north', 'south', 'east', 'west'];

function validateVehicleCount(value) {
  if (!Number.isFinite(Number(value)) || Number(value) < 0) {
    throw new Error('vehicle counts must be finite non-negative number values');
  }
}

function validateTrafficPayload(payload = {}) {
  const networkVehicles = payload.networkVehicles || payload.vehicles;
  if (networkVehicles === undefined) return;
  if (!networkVehicles || typeof networkVehicles !== 'object' || Array.isArray(networkVehicles)) {
    throw new Error('networkVehicles must be an object');
  }

  for (const [junctionId, counts] of Object.entries(networkVehicles)) {
    if (!JUNCTIONS.includes(junctionId) || !counts || typeof counts !== 'object' || Array.isArray(counts)) {
      throw new Error('networkVehicles contains an invalid junction');
    }
    for (const direction of DIRECTIONS) {
      if (counts[direction] === undefined) continue;
      validateVehicleCount(counts[direction]);
    }
  }
}

module.exports = { validateVehicleCount, validateTrafficPayload, JUNCTIONS, DIRECTIONS };
