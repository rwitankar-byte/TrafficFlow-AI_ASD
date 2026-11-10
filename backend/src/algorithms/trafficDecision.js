/**
 * Traffic Signal Decision Algorithm
 * Evaluates traffic density across junctions or directional lanes,
 * classifies traffic into 4 density tiers, and handles emergency vehicle
 * priority preemption and hospital green corridor pathfinding.
 */

// 4-Tier Timing Constants based on project proposal
const TRAFFIC_TIERS = {
  LOW: {
    maxVehicles: 19,
    greenTime: 15,
    name: 'Low',
    level: 'LOW'
  },
  MEDIUM: {
    maxVehicles: 50,
    greenTime: 25,
    name: 'Medium',
    level: 'MEDIUM'
  },
  HIGH: {
    maxVehicles: 80,
    greenTime: 35,
    name: 'High',
    level: 'HIGH'
  },
  VERY_HIGH: {
    maxVehicles: 999,
    greenTime: 45,
    name: 'Very High',
    level: 'VERY_HIGH'
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
 * @returns {Object} Tier information
 */
function classifyTrafficTier(count) {
  const vehicleCount = Math.max(0, Number(count) || 0);

  if (vehicleCount <= TRAFFIC_TIERS.LOW.maxVehicles) {
    return { ...TRAFFIC_TIERS.LOW, vehicleCount };
  }
  if (vehicleCount <= TRAFFIC_TIERS.MEDIUM.maxVehicles) {
    return { ...TRAFFIC_TIERS.MEDIUM, vehicleCount };
  }
  if (vehicleCount <= TRAFFIC_TIERS.HIGH.maxVehicles) {
    return { ...TRAFFIC_TIERS.HIGH, vehicleCount };
  }
  return { ...TRAFFIC_TIERS.VERY_HIGH, vehicleCount };
}

/**
 * Calculates optimal emergency path to City Hospital (connected to J4)
 * @param {string} startJunction - 'J1', 'J2', 'J3', or 'J4'
 * @returns {Array<string>} Shortest route of junctions to hospital
 */
function getHospitalCorridorPath(startJunction) {
  const paths = {
    J1: ['J1', 'J2', 'J4', 'HOSPITAL'],
    J2: ['J2', 'J4', 'HOSPITAL'],
    J3: ['J3', 'J4', 'HOSPITAL'],
    J4: ['J4', 'HOSPITAL']
  };
  return paths[startJunction] || ['J4', 'HOSPITAL'];
}

/**
 * Calculates multi-junction network signal decision (J1, J2, J3, J4)
 * Used by the frontend live simulation.
 * 
 * @param {Object} params
 * @param {Object} params.vehicles - { J1: number, J2: number, J3: number, J4: number }
 * @param {Object|null} params.ambulance - { junction: string, progress: number }
 * @param {string} [params.currentGreen] - Currently active junction (if any)
 * @param {boolean} [params.isNextCycle] - Whether rotating to next cycle after yellow
 */
function calculateNetworkDecision({ vehicles = {}, ambulance = null, currentGreen = null, isNextCycle = false }) {
  const junctionIds = ['J1', 'J2', 'J3', 'J4'];

  // Normalize vehicle counts & calculate 4-tier info for every junction
  const junctionsAnalysis = {};
  for (const jId of junctionIds) {
    const count = Number(vehicles[jId] ?? vehicles[jId.toLowerCase()] ?? 0);
    junctionsAnalysis[jId] = classifyTrafficTier(count);
  }

  // Handle Emergency Green Corridor
  if (ambulance && ambulance.junction) {
    const path = getHospitalCorridorPath(ambulance.junction);
    const pathJunctions = path.filter(p => p !== 'HOSPITAL');

    let targetGreen = ambulance.junction;

    if (isNextCycle && currentGreen) {
      const currentIndex = pathJunctions.indexOf(currentGreen);
      targetGreen = pathJunctions[(currentIndex + 1) % pathJunctions.length] || 'J4';
    }

    return {
      activeGreen: targetGreen,
      greenDuration: EMERGENCY_GREEN_TIME,
      isEmergency: true,
      ambulance: {
        active: true,
        startJunction: ambulance.junction,
        targetHospital: 'HOSPITAL',
        corridorPath: path,
        progress: ambulance.progress || 0
      },
      junctions: junctionsAnalysis,
      message: `🚨 Emergency Green Corridor Active: Priority green assigned to ${targetGreen} for Ambulance route to City Hospital.`
    };
  }

  // Normal Adaptive Decision
  // Sort junctions by vehicle count descending (highest traffic gets priority)
  const sorted = [...junctionIds].sort((a, b) => {
    return junctionsAnalysis[b].vehicleCount - junctionsAnalysis[a].vehicleCount;
  });

  let selectedJunction = sorted[0];

  // If rotating to next cycle, choose next highest junction excluding current
  if (isNextCycle && currentGreen) {
    const remaining = junctionIds.filter(j => j !== currentGreen);
    selectedJunction = remaining.sort((a, b) => junctionsAnalysis[b].vehicleCount - junctionsAnalysis[a].vehicleCount)[0];
  }

  const tier = junctionsAnalysis[selectedJunction];

  return {
    activeGreen: selectedJunction,
    greenDuration: tier.greenTime,
    isEmergency: false,
    ambulance: null,
    tier: {
      name: tier.name,
      level: tier.level,
      greenTime: tier.greenTime
    },
    cycleOrder: sorted,
    junctions: junctionsAnalysis,
    message: `⚡ Adaptive Decision: ${selectedJunction} selected (${tier.vehicleCount} cars, ${tier.name} Tier) -> ${tier.greenTime}s Green.`
  };
}

/**
 * Standard directional calculation (North, South, East, West)
 */
function calculateSignalTiming(trafficData = {}) {
  // Support both directional and J1-J4 data
  if (trafficData.J1 !== undefined || trafficData.vehicles !== undefined) {
    const vehicles = trafficData.vehicles || {
      J1: trafficData.J1,
      J2: trafficData.J2,
      J3: trafficData.J3,
      J4: trafficData.J4
    };
    return calculateNetworkDecision({
      vehicles,
      ambulance: trafficData.ambulance,
      currentGreen: trafficData.currentGreen,
      isNextCycle: Boolean(trafficData.isNextCycle)
    });
  }

  const directions = ['north', 'south', 'east', 'west'];

  const directionsAnalysis = {};
  for (const dir of directions) {
    const vehicleCount = Math.max(0, Number(trafficData[dir]) || 0);
    const tier = classifyTrafficTier(vehicleCount);

    directionsAnalysis[dir] = {
      vehicleCount,
      trafficLevel: tier.name.toUpperCase().replace(' ', '_'),
      label: tier.name,
      greenTime: tier.greenTime
    };
  }

  const rawEmergencyDir = trafficData.emergencyDirection || trafficData.emergency || null;
  const normalizedEmergencyDir = rawEmergencyDir ? String(rawEmergencyDir).toLowerCase() : null;
  const isEmergencyValid = directions.includes(normalizedEmergencyDir);

  const emergencyInfo = {
    active: isEmergencyValid,
    direction: isEmergencyValid ? normalizedEmergencyDir.toUpperCase() : null,
    vehicleType: isEmergencyValid ? (trafficData.emergencyVehicleType || 'AMBULANCE').toUpperCase() : null,
    overrideDuration: isEmergencyValid ? EMERGENCY_GREEN_TIME : 0
  };

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
  calculateNetworkDecision,
  classifyTrafficTier,
  getHospitalCorridorPath,
  TRAFFIC_TIERS,
  EMERGENCY_GREEN_TIME,
  YELLOW_TIME,
  ALL_RED_TIME
};
