/**
 * 16-Signal Multi-Junction Traffic Decision Engine
 * 
 * Manages 4 interconnected 4-way junctions (J1, J2, J3, J4).
 * Each junction has 4 directional signal heads: NORTH, SOUTH, EAST, WEST.
 * Total signals = 4 junctions x 4 directions = 16 Traffic Lights!
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
 * Hospital corridor direction for each junction along the ambulance route
 * Hospital is connected to J4's East exit.
 */
const CORRIDOR_DIRECTIONS = {
  J1: { nextJunction: 'J2', greenDirection: 'EAST' },
  J2: { nextJunction: 'J4', greenDirection: 'SOUTH' },
  J3: { nextJunction: 'J4', greenDirection: 'EAST' },
  J4: { nextJunction: 'HOSPITAL', greenDirection: 'EAST' }
};

/**
 * Calculates signal decision for a single 4-way junction
 * 
 * @param {Object} directionCounts - { north, south, east, west }
 * @param {string|null} emergencyDirection - 'NORTH', 'SOUTH', 'EAST', 'WEST' or null
 * @param {string|null} currentActive - Currently active direction
 * @param {boolean} isNextCycle - Whether advancing to next direction in cycle
 */
function evaluateSingleJunction(directionCounts = {}, emergencyDirection = null, currentActive = null, isNextCycle = false) {
  const directions = ['north', 'south', 'east', 'west'];
  const directionsAnalysis = {};

  for (const dir of directions) {
    const count = Number(directionCounts[dir] ?? 0);
    directionsAnalysis[dir] = classifyTrafficTier(count);
  }

  // Check for Emergency Preemption on this specific junction
  if (emergencyDirection) {
    const normDir = emergencyDirection.toLowerCase();
    if (directions.includes(normDir)) {
      const activeUpper = emergencyDirection.toUpperCase();
      return {
        activeDirection: activeUpper,
        duration: EMERGENCY_GREEN_TIME,
        isEmergency: true,
        directions: {
          north: { ...directionsAnalysis.north, signal: activeUpper === 'NORTH' ? 'GREEN' : 'RED' },
          south: { ...directionsAnalysis.south, signal: activeUpper === 'SOUTH' ? 'GREEN' : 'RED' },
          east:  { ...directionsAnalysis.east,  signal: activeUpper === 'EAST'  ? 'GREEN' : 'RED' },
          west:  { ...directionsAnalysis.west,  signal: activeUpper === 'WEST'  ? 'GREEN' : 'RED' }
        },
        cycleOrder: [activeUpper, ...directions.map(d => d.toUpperCase()).filter(d => d !== activeUpper)],
        message: `🚨 Emergency Corridor: ${activeUpper} granted immediate green for emergency clearance.`
      };
    }
  }

  // Check which directions actually have waiting vehicles (> 0)
  const waitingDirections = directions.filter(d => directionsAnalysis[d].vehicleCount > 0);

  // RULE: If ALL directions have 0 vehicles -> ALL SIGNALS REMAIN RED (Standby)
  if (waitingDirections.length === 0) {
    return {
      activeDirection: 'ALL_RED',
      duration: 5,
      isEmergency: false,
      tier: { name: 'Standby', level: 'STANDBY', greenTime: 5 },
      directions: {
        north: { ...directionsAnalysis.north, signal: 'RED' },
        south: { ...directionsAnalysis.south, signal: 'RED' },
        east:  { ...directionsAnalysis.east,  signal: 'RED' },
        west:  { ...directionsAnalysis.west,  signal: 'RED' }
      },
      cycleOrder: [],
      message: `🛑 All-Red Standby: 0 vehicles waiting across all approaches. All signals RED.`
    };
  }

  // Normal Adaptive Signal Evaluation
  // Sort ONLY the directions that have > 0 vehicles by count descending
  const sorted = [...waitingDirections].sort((a, b) => {
    return directionsAnalysis[b].vehicleCount - directionsAnalysis[a].vehicleCount;
  });

  let selectedDir = sorted[0];

  // If cycle rotation requested, pick next highest direction with waiting vehicles (> 0)
  if (isNextCycle && currentActive) {
    const currentLower = currentActive.toLowerCase();
    const remaining = sorted.filter(d => d !== currentLower);
    selectedDir = remaining[0] || sorted[0];
  }

  // Double check: Never turn green if vehicle count is 0
  if (directionsAnalysis[selectedDir].vehicleCount === 0) {
    selectedDir = sorted[0];
  }

  const activeUpper = selectedDir.toUpperCase();
  const activeTier = directionsAnalysis[selectedDir];

  return {
    activeDirection: activeUpper,
    duration: activeTier.greenTime,
    isEmergency: false,
    tier: {
      name: activeTier.name,
      level: activeTier.level,
      greenTime: activeTier.greenTime
    },
    directions: {
      north: { ...directionsAnalysis.north, signal: activeUpper === 'NORTH' && directionsAnalysis.north.vehicleCount > 0 ? 'GREEN' : 'RED' },
      south: { ...directionsAnalysis.south, signal: activeUpper === 'SOUTH' && directionsAnalysis.south.vehicleCount > 0 ? 'GREEN' : 'RED' },
      east:  { ...directionsAnalysis.east,  signal: activeUpper === 'EAST'  && directionsAnalysis.east.vehicleCount > 0  ? 'GREEN' : 'RED' },
      west:  { ...directionsAnalysis.west,  signal: activeUpper === 'WEST'  && directionsAnalysis.west.vehicleCount > 0  ? 'GREEN' : 'RED' }
    },
    cycleOrder: sorted.map(d => d.toUpperCase()),
    message: `⚡ Adaptive: ${activeUpper} selected (${activeTier.vehicleCount} cars, ${activeTier.name} Tier) -> ${activeTier.greenTime}s Green.`
  };
}

/**
 * Calculates signal decisions for ALL 16 signals across all 4 junctions (J1, J2, J3, J4)
 * 
 * @param {Object} params
 * @param {Object} params.networkVehicles - { J1: {north,south,east,west}, J2: {...}, J3: {...}, J4: {...} }
 * @param {Object|null} params.ambulance - { junction: 'J1', progress: 0 }
 * @param {Object} params.activeSignals - { J1: 'NORTH', J2: 'EAST', ... }
 * @param {string|null} params.rotatingJunction - Which junction's timer reached zero (if any)
 */
function calculate16SignalNetworkDecision({ networkVehicles = {}, ambulance = null, activeSignals = {}, rotatingJunction = null }) {
  const junctionIds = ['J1', 'J2', 'J3', 'J4'];
  const networkDecision = {};

  // Localized Emergency Preemption:
  // ONLY the junction where the ambulance has actually arrived gets emergency green!
  // All other junctions continue their normal adaptive logic based on vehicle counts.
  let corridorActiveJunctions = {};
  if (ambulance && (ambulance.currentJunction || ambulance.junction)) {
    const activeAt = ambulance.currentJunction || ambulance.junction;

    // Directional exit towards City Hospital when ambulance is at that junction
    const exitDirections = {
      J1: 'EAST',  // exits J1 towards J2
      J2: 'SOUTH', // exits J2 towards J4
      J3: 'EAST',  // exits J3 towards J4
      J4: 'EAST'   // exits J4 towards City Hospital
    };

    if (exitDirections[activeAt]) {
      corridorActiveJunctions[activeAt] = exitDirections[activeAt];
    }
  }

  // Evaluate each of the 4 junctions
  for (const jId of junctionIds) {
    const jCounts = networkVehicles[jId] || { north: 10, south: 10, east: 10, west: 10 };
    const emergencyDir = corridorActiveJunctions[jId] || null;
    const currentActive = activeSignals[jId] || null;
    const isRotating = rotatingJunction === jId;

    networkDecision[jId] = evaluateSingleJunction(jCounts, emergencyDir, currentActive, isRotating);
  }

  return {
    status: 'success',
    timestamp: new Date().toISOString(),
    totalSignals: 16,
    junctions: networkDecision,
    ambulance: ambulance ? {
      active: true,
      startJunction: ambulance.junction,
      corridorActiveJunctions,
      targetHospital: 'HOSPITAL',
      progress: ambulance.progress || 0
    } : { active: false }
  };
}

module.exports = {
  evaluateSingleJunction,
  calculate16SignalNetworkDecision,
  classifyTrafficTier,
  CORRIDOR_DIRECTIONS,
  TRAFFIC_TIERS,
  EMERGENCY_GREEN_TIME,
  YELLOW_TIME,
  ALL_RED_TIME
};
