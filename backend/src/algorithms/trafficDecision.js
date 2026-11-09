/**
 * Traffic Signal Decision Algorithm
 * Evaluates traffic density at an intersection, classifies traffic into
 * 4 density tiers, and handles emergency vehicle priority overrides.
 */

// 4-Tier Timing Constants based on project proposal
const TRAFFIC_TIERS = {
  LOW: {
    maxVehicles: 19,
    greenTime: 15,
    label: 'Low'
  },
  MEDIUM: {
    maxVehicles: 50,
    greenTime: 25,
    label: 'Medium'
  },
  HIGH: {
    maxVehicles: 80,
    greenTime: 35,
    label: 'High'
  },
  VERY_HIGH: {
    maxVehicles: Infinity,
    greenTime: 45,
    label: 'Very high'
  }
};

const EMERGENCY_GREEN_TIME = 45; // Dedicated green clearance for ambulances/fire engines
const YELLOW_TIME = 3;           // Standard safe yellow transition interval
const ALL_RED_TIME = 2;          // All-red clearance interval for intersection safety

/**
 * Classifies vehicle count into one of 4 tiers (Low, Medium, High, Very High)
 * and returns its allocated green-light time.
 * 
 * @param {number} count - Number of vehicles detected
 * @returns {Object} { level: string, label: string, greenTime: number }
 */
function classifyTrafficTier(count) {
  const vehicleCount = Math.max(0, Number(count) || 0);

  if (vehicleCount <= TRAFFIC_TIERS.LOW.maxVehicles) {
    return { level: 'LOW', label: TRAFFIC_TIERS.LOW.label, greenTime: TRAFFIC_TIERS.LOW.greenTime };
  }
  if (vehicleCount <= TRAFFIC_TIERS.MEDIUM.maxVehicles) {
    return { level: 'MEDIUM', label: TRAFFIC_TIERS.MEDIUM.label, greenTime: TRAFFIC_TIERS.MEDIUM.greenTime };
  }
  if (vehicleCount <= TRAFFIC_TIERS.HIGH.maxVehicles) {
    return { level: 'HIGH', label: TRAFFIC_TIERS.HIGH.label, greenTime: TRAFFIC_TIERS.HIGH.greenTime };
  }
  return { level: 'VERY_HIGH', label: TRAFFIC_TIERS.VERY_HIGH.label, greenTime: TRAFFIC_TIERS.VERY_HIGH.greenTime };
}

/**
 * Calculates dynamic signal timing for all directions and handles emergency vehicle preemption.
 * 
 * @param {Object} trafficData
 * @param {number} [trafficData.north] - Vehicle count for North road
 * @param {number} [trafficData.south] - Vehicle count for South road
 * @param {number} [trafficData.east]  - Vehicle count for East road
 * @param {number} [trafficData.west]  - Vehicle count for West road
 * @param {string} [trafficData.emergencyDirection] - Direction of emergency vehicle ('NORTH', 'SOUTH', 'EAST', 'WEST', or null)
 * @param {string} [trafficData.emergencyVehicleType] - 'AMBULANCE' | 'FIRE_ENGINE' | null
 * 
 * @returns {Object} Signal timing decision and cycle schedule
 */
function calculateSignalTiming(trafficData = {}) {
  const directions = ['north', 'south', 'east', 'west'];

  // 1. Process vehicle counts and assign 4-tier timing for each direction
  const directionsAnalysis = {};
  for (const dir of directions) {
    const vehicleCount = Math.max(0, Number(trafficData[dir]) || 0);
    const tier = classifyTrafficTier(vehicleCount);

    directionsAnalysis[dir] = {
      vehicleCount,
      trafficLevel: tier.level,
      label: tier.label,
      greenTime: tier.greenTime
    };
  }

  // 2. Check for Emergency Vehicle Preemption
  const rawEmergencyDir = trafficData.emergencyDirection || trafficData.emergency || null;
  const normalizedEmergencyDir = rawEmergencyDir ? String(rawEmergencyDir).toLowerCase() : null;
  const isEmergencyValid = directions.includes(normalizedEmergencyDir);

  const emergencyInfo = {
    active: isEmergencyValid,
    direction: isEmergencyValid ? normalizedEmergencyDir.toUpperCase() : null,
    vehicleType: isEmergencyValid ? (trafficData.emergencyVehicleType || 'AMBULANCE').toUpperCase() : null,
    overrideDuration: isEmergencyValid ? EMERGENCY_GREEN_TIME : 0
  };

  // 3. Determine Priority & Cycle Ordering
  // Sort directions: highest vehicle count gets served first
  const sortedDirections = [...directions].sort((a, b) => {
    return directionsAnalysis[b].vehicleCount - directionsAnalysis[a].vehicleCount;
  });

  let activeDirection;
  let activeDuration;

  if (emergencyInfo.active) {
    activeDirection = emergencyInfo.direction;
    activeDuration = EMERGENCY_GREEN_TIME;
  } else {
    activeDirection = sortedDirections[0].toUpperCase();
    activeDuration = directionsAnalysis[sortedDirections[0]].greenTime;
  }

  const totalCycleGreenTime = Object.values(directionsAnalysis)
    .reduce((acc, curr) => acc + curr.greenTime, 0);

  return {
    greenDirection: activeDirection,
    duration: activeDuration,
    emergency: emergencyInfo,
    directions: directionsAnalysis,
    cycleOrder: emergencyInfo.active 
      ? [emergencyInfo.direction, ...sortedDirections.map(d => d.toUpperCase()).filter(d => d !== emergencyInfo.direction)]
      : sortedDirections.map(d => d.toUpperCase()),
    totalCycleDuration: totalCycleGreenTime
  };
}

module.exports = {
  calculateSignalTiming,
  classifyTrafficTier,
  TRAFFIC_TIERS,
  EMERGENCY_GREEN_TIME,
  YELLOW_TIME,
  ALL_RED_TIME
};
