/**
 * ==============================================================================
 * SAFE ADAPTIVE TRAFFIC SIGNAL DECISION ENGINE
 * ==============================================================================
 * Features:
 * 1. Safe Signal Phases (NORTH_SOUTH vs EAST_WEST opposing pairs)
 *    - Conflicting directions are NEVER green simultaneously.
 *    - All 4 directions are NEVER green simultaneously.
 * 2. Safe Transitions: CURRENT GREEN -> YELLOW -> ALL RED -> NEXT SAFE GREEN
 * 3. Weighted Priority Scoring: vehicleCount, waitingTime, congestionLevel
 * 4. Starvation Prevention: Guaranteed service if waitingTime >= MAX_WAIT_TIME
 * 5. Dynamic Green Time Clamping: MIN_GREEN_TIME (15s) to MAX_GREEN_TIME (60s)
 * 6. Emergency Preemption: Dedicated clearance corridor for ambulances
 * ==============================================================================
 */

// 1. Predefined Safe Phases
const SAFE_PHASES = {
  NORTH_SOUTH: {
    name: 'NORTH_SOUTH',
    label: 'North / South Active',
    greenDirections: ['north', 'south'],
    conflictingDirections: ['east', 'west']
  },
  EAST_WEST: {
    name: 'EAST_WEST',
    label: 'East / West Active',
    greenDirections: ['east', 'west'],
    conflictingDirections: ['north', 'south']
  }
};

// 2. Configurable Signal Timings
const SIGNAL_CONFIG = {
  minGreenTime: 15,
  maxGreenTime: 60,
  yellowTime: 3,
  allRedTime: 2,
  greenFactor: 0.5 // Seconds added per priority score point
};

// 3. Priority Scoring Weights
const PRIORITY_WEIGHTS = {
  VEHICLE_WEIGHT: 1.0,
  WAITING_WEIGHT: 0.5,
  CONGESTION_WEIGHT: 2.0
};

// 4. Starvation Prevention Constant
const MAX_WAIT_TIME = 60; // Max allowable waiting time in seconds
const STARVATION_BOOST = 1000; // Priority override bonus for starved direction

const EMERGENCY_GREEN_TIME = 45; // Ambulance clearance green duration

/**
 * Normalizes input for a single direction and calculates its priority score.
 * 
 * Formula:
 * Priority Score = (vehicleCount * VEHICLE_WEIGHT) + 
 *                  (waitingTime * WAITING_WEIGHT) + 
 *                  (congestionLevel * CONGESTION_WEIGHT)
 * 
 * @param {Object|number} directionData - Raw count number or { vehicleCount, waitingTime, congestionLevel }
 * @returns {Object} { vehicleCount, waitingTime, congestionLevel, score }
 */
function calculateDirectionPriority(directionData) {
  let vehicleCount = 0;
  let waitingTime = 0;
  let congestionLevel = 0;

  if (typeof directionData === 'number') {
    vehicleCount = Math.max(0, directionData);
    waitingTime = 0;
    congestionLevel = vehicleCount > 50 ? 3 : vehicleCount > 20 ? 2 : vehicleCount > 0 ? 1 : 0;
  } else if (directionData && typeof directionData === 'object') {
    vehicleCount = Math.max(0, Number(directionData.vehicleCount ?? directionData.count ?? 0));
    waitingTime = Math.max(0, Number(directionData.waitingTime ?? 0));
    congestionLevel = Number(
      directionData.congestionLevel ?? 
      (vehicleCount > 50 ? 3 : vehicleCount > 20 ? 2 : vehicleCount > 0 ? 1 : 0)
    );
  }

  const score = (vehicleCount * PRIORITY_WEIGHTS.VEHICLE_WEIGHT) +
                (waitingTime * PRIORITY_WEIGHTS.WAITING_WEIGHT) +
                (congestionLevel * PRIORITY_WEIGHTS.CONGESTION_WEIGHT);

  return {
    vehicleCount,
    waitingTime,
    congestionLevel,
    score: Math.round(score * 10) / 10
  };
}

/**
 * Calculates priority score of a safe phase by summing the priorities of its green directions.
 * 
 * @param {string} phaseKey - 'NORTH_SOUTH' or 'EAST_WEST'
 * @param {Object} analyzedTraffic - { north: {...}, south: {...}, east: {...}, west: {...} }
 * @returns {number} Summed priority score for that phase
 */
function calculatePhasePriority(phaseKey, analyzedTraffic) {
  const phase = SAFE_PHASES[phaseKey];
  if (!phase) return 0;

  let totalScore = 0;
  for (const dir of phase.greenDirections) {
    totalScore += (analyzedTraffic[dir]?.score || 0);
  }
  return Math.round(totalScore * 10) / 10;
}

/**
 * Checks if any waiting direction has exceeded the maximum allowable wait time.
 * 
 * @param {Object} analyzedTraffic - { north: {...}, south: {...}, east: {...}, west: {...} }
 * @returns {Object} { starved: boolean, direction: string|null, requiredPhase: string|null }
 */
function checkStarvation(analyzedTraffic) {
  for (const dir of ['north', 'south', 'east', 'west']) {
    const data = analyzedTraffic[dir];
    if (data && data.waitingTime >= MAX_WAIT_TIME && data.vehicleCount > 0) {
      const requiredPhase = (dir === 'north' || dir === 'south') ? 'NORTH_SOUTH' : 'EAST_WEST';
      return {
        starved: true,
        direction: dir,
        waitingTime: data.waitingTime,
        requiredPhase
      };
    }
  }
  return { starved: false, direction: null, requiredPhase: null };
}

/**
 * Calculates dynamic green light duration clamped between minGreenTime and maxGreenTime.
 * 
 * Formula:
 * greenTime = clamp(minGreenTime + (priorityScore * greenFactor), minGreenTime, maxGreenTime)
 * 
 * @param {number} priorityScore - Computed priority score for the active phase
 * @returns {number} Clamped green duration in seconds
 */
function calculateGreenDuration(priorityScore) {
  const calculated = SIGNAL_CONFIG.minGreenTime + (priorityScore * SIGNAL_CONFIG.greenFactor);
  const rounded = Math.round(calculated);
  return Math.min(SIGNAL_CONFIG.maxGreenTime, Math.max(SIGNAL_CONFIG.minGreenTime, rounded));
}

/**
 * Determines emergency preemption requirements if an emergency vehicle is reported.
 * 
 * @param {Object|string|null} emergencyData - e.g. { emergencyVehicle: true, direction: 'east' } or 'EAST'
 * @returns {Object} { isEmergency: boolean, direction: string|null, requiredPhase: string|null }
 */
function handleEmergencyVehicle(emergencyData) {
  if (!emergencyData) {
    return { isEmergency: false, direction: null, requiredPhase: null };
  }

  let dir = null;
  if (typeof emergencyData === 'string') {
    dir = emergencyData.toLowerCase();
  } else if (emergencyData && typeof emergencyData === 'object') {
    if (emergencyData.emergencyVehicle || emergencyData.isEmergency || emergencyData.direction) {
      dir = (emergencyData.direction || emergencyData.corridorDirection || '').toLowerCase();
    }
  }

  if (['north', 'south'].includes(dir)) {
    return { isEmergency: true, direction: dir.toUpperCase(), requiredPhase: 'NORTH_SOUTH' };
  }
  if (['east', 'west'].includes(dir)) {
    return { isEmergency: true, direction: dir.toUpperCase(), requiredPhase: 'EAST_WEST' };
  }

  return { isEmergency: false, direction: null, requiredPhase: null };
}

/**
 * Selects the best safe phase (NORTH_SOUTH vs EAST_WEST) based on:
 * 1. Emergency Preemption (Highest override)
 * 2. Starvation Prevention (Second override)
 * 3. Summed Phase Priority Score (Standard adaptive logic)
 * 
 * @param {Object} analyzedTraffic - Analyzed directional traffic data
 * @param {Object|string|null} emergencyData - Emergency vehicle information
 * @returns {Object} Selected phase details and reasoning
 */
function selectBestPhase(analyzedTraffic, emergencyData = null) {
  // 1. Emergency Preemption Check
  const emergency = handleEmergencyVehicle(emergencyData);
  if (emergency.isEmergency && emergency.requiredPhase) {
    return {
      phase: emergency.requiredPhase,
      reason: 'EMERGENCY_PREEMPTION',
      emergencyDirection: emergency.direction,
      message: `🚨 Emergency Preemption: Ambulance from ${emergency.direction} requires safe phase ${emergency.requiredPhase}.`
    };
  }

  // 2. Starvation Prevention Check
  const starvation = checkStarvation(analyzedTraffic);
  if (starvation.starved && starvation.requiredPhase) {
    return {
      phase: starvation.requiredPhase,
      reason: 'STARVATION_PREVENTION',
      starvedDirection: starvation.direction,
      message: `⚠️ Starvation Prevention: ${starvation.direction.toUpperCase()} waited ${starvation.waitingTime}s (>= ${MAX_WAIT_TIME}s). Forcing phase ${starvation.requiredPhase}.`
    };
  }

  // 3. Normal Adaptive Priority Comparison
  const nsPriority = calculatePhasePriority('NORTH_SOUTH', analyzedTraffic);
  const ewPriority = calculatePhasePriority('EAST_WEST', analyzedTraffic);

  const selectedPhase = nsPriority >= ewPriority ? 'NORTH_SOUTH' : 'EAST_WEST';
  const selectedPriority = selectedPhase === 'NORTH_SOUTH' ? nsPriority : ewPriority;

  return {
    phase: selectedPhase,
    reason: 'ADAPTIVE_PRIORITY',
    phasePriorities: {
      NORTH_SOUTH: nsPriority,
      EAST_WEST: ewPriority
    },
    message: `⚡ Adaptive: Phase ${selectedPhase} selected (Score: ${selectedPriority} vs ${selectedPhase === 'NORTH_SOUTH' ? ewPriority : nsPriority}).`
  };
}

/**
 * Deterministic Signal State Transition:
 * Ensures conflicting phases NEVER switch directly without clearance!
 * 
 * Sequence: CURRENT GREEN -> YELLOW (3s) -> ALL RED (2s) -> NEXT SAFE GREEN
 * 
 * @param {string} currentPhase - Currently active phase ('NORTH_SOUTH' or 'EAST_WEST')
 * @param {string} targetPhase - Desired safe phase to activate
 * @param {string} currentSignalState - 'GREEN', 'YELLOW', or 'ALL_RED'
 * @returns {Object} Transition state output
 */
function transitionSignal(currentPhase, targetPhase, currentSignalState = 'GREEN') {
  // If target phase is the same as current phase
  if (!currentPhase || currentPhase === targetPhase) {
    return {
      phase: targetPhase,
      signalState: 'GREEN',
      duration: SIGNAL_CONFIG.minGreenTime,
      transitionStep: 'MAINTAIN_GREEN'
    };
  }

  // Conflicting phase transition safety pipeline
  if (currentSignalState === 'GREEN') {
    return {
      phase: currentPhase,
      signalState: 'YELLOW',
      duration: SIGNAL_CONFIG.yellowTime,
      transitionStep: 'YELLOW_CLEARANCE',
      nextPhase: targetPhase
    };
  }

  if (currentSignalState === 'YELLOW') {
    return {
      phase: currentPhase,
      signalState: 'ALL_RED',
      duration: SIGNAL_CONFIG.allRedTime,
      transitionStep: 'ALL_RED_CLEARANCE',
      nextPhase: targetPhase
    };
  }

  // When ALL_RED is complete, safely switch to the next safe phase in GREEN
  return {
    phase: targetPhase,
    signalState: 'GREEN',
    duration: SIGNAL_CONFIG.minGreenTime,
    transitionStep: 'NEW_PHASE_GREEN'
  };
}

/**
 * Evaluates a single 4-way intersection under the Safe Adaptive Traffic System.
 * 
 * @param {Object} params
 * @param {Object} params.trafficData - { north, south, east, west } counts or objects
 * @param {string|null} params.currentPhase - 'NORTH_SOUTH' or 'EAST_WEST'
 * @param {string} params.currentSignalState - 'GREEN' | 'YELLOW' | 'ALL_RED'
 * @param {Object|string|null} params.emergency - Ambulance info
 */
function evaluateSafeIntersection({
  trafficData = {},
  currentPhase = 'NORTH_SOUTH',
  currentSignalState = 'GREEN',
  emergency = null
}) {
  // 1. Analyze directional priority scores
  const analyzedTraffic = {
    north: calculateDirectionPriority(trafficData.north),
    south: calculateDirectionPriority(trafficData.south),
    east:  calculateDirectionPriority(trafficData.east),
    west:  calculateDirectionPriority(trafficData.west)
  };

  // 2. Select the optimal safe phase
  const decision = selectBestPhase(analyzedTraffic, emergency);
  const targetPhase = decision.phase;

  // 3. Determine dynamic green duration
  const activePriority = calculatePhasePriority(targetPhase, analyzedTraffic);
  const greenDuration = decision.reason === 'EMERGENCY_PREEMPTION' 
    ? EMERGENCY_GREEN_TIME 
    : calculateGreenDuration(activePriority);

  // 4. Handle safe signal state transition
  let activePhase = currentPhase;
  let activeState = currentSignalState;
  let duration = greenDuration;

  if (currentPhase !== targetPhase) {
    const transition = transitionSignal(currentPhase, targetPhase, currentSignalState);
    activePhase = transition.phase;
    activeState = transition.signalState;
    duration = transition.signalState === 'GREEN' ? greenDuration : transition.duration;
  } else {
    activePhase = targetPhase;
    activeState = 'GREEN';
    duration = greenDuration;
  }

  // 5. Generate individual signal states based strictly on the safe phase definition
  const safePhaseConfig = SAFE_PHASES[activePhase] || SAFE_PHASES.NORTH_SOUTH;
  const directionalSignals = {};

  for (const dir of ['north', 'south', 'east', 'west']) {
    let signal = 'RED';
    if (activeState === 'ALL_RED') {
      signal = 'RED';
    } else if (safePhaseConfig.greenDirections.includes(dir)) {
      signal = activeState === 'YELLOW' ? 'YELLOW' : 'GREEN';
    } else {
      signal = 'RED';
    }

    directionalSignals[dir] = {
      signal,
      vehicleCount: analyzedTraffic[dir].vehicleCount,
      waitingTime: analyzedTraffic[dir].waitingTime,
      congestionLevel: analyzedTraffic[dir].congestionLevel,
      priorityScore: analyzedTraffic[dir].score
    };
  }

  return {
    status: 'success',
    timestamp: new Date().toISOString(),
    currentPhase: activePhase,
    targetPhase,
    signalState: activeState,
    duration,
    remainingTime: duration,
    emergencyMode: decision.reason === 'EMERGENCY_PREEMPTION',
    emergencyDirection: decision.emergencyDirection || null,
    starvationActive: decision.reason === 'STARVATION_PREVENTION',
    starvedDirection: decision.starvedDirection || null,
    priorityScores: {
      north: analyzedTraffic.north,
      south: analyzedTraffic.south,
      east:  analyzedTraffic.east,
      west:  analyzedTraffic.west,
      phases: {
        NORTH_SOUTH: calculatePhasePriority('NORTH_SOUTH', analyzedTraffic),
        EAST_WEST: calculatePhasePriority('EAST_WEST', analyzedTraffic)
      }
    },
    directions: directionalSignals,
    safePhases: SAFE_PHASES,
    message: decision.message
  };
}

/**
 * Backward compatibility wrapper for single junction evaluation
 */
function evaluateSingleJunction(directionCounts = {}, emergencyDirection = null, currentActive = null, isNextCycle = false) {
  // Infer current phase from currentActive direction
  let currentPhase = 'NORTH_SOUTH';
  if (currentActive) {
    const norm = currentActive.toUpperCase();
    if (norm === 'EAST' || norm === 'WEST' || norm === 'EAST_WEST') {
      currentPhase = 'EAST_WEST';
    }
  }

  const result = evaluateSafeIntersection({
    trafficData: directionCounts,
    currentPhase,
    currentSignalState: 'GREEN',
    emergency: emergencyDirection
  });

  return {
    activeDirection: result.currentPhase,
    activePhase: result.currentPhase,
    duration: result.duration,
    isEmergency: result.emergencyMode,
    signalState: result.signalState,
    directions: result.directions,
    priorityScores: result.priorityScores,
    message: result.message
  };
}

/**
 * Calculates signal decisions for ALL junctions across the network using Safe Phases
 */
function calculate16SignalNetworkDecision({ networkVehicles = {}, ambulance = null, activeSignals = {}, rotatingJunction = null }) {
  const junctionIds = ['J1', 'J2', 'J3', 'J4'];
  const networkDecision = {};

  let corridorActiveJunctions = {};
  if (ambulance && (ambulance.currentJunction || ambulance.junction)) {
    const activeAt = ambulance.currentJunction || ambulance.junction;
    const exitDirections = {
      J1: 'EAST',
      J2: 'SOUTH',
      J3: 'EAST',
      J4: 'EAST'
    };
    if (exitDirections[activeAt]) {
      corridorActiveJunctions[activeAt] = exitDirections[activeAt];
    }
  }

  for (const jId of junctionIds) {
    const jCounts = networkVehicles[jId] || { north: 10, south: 10, east: 10, west: 10 };
    const emergencyDir = corridorActiveJunctions[jId] || null;
    const currentActive = activeSignals[jId] || 'NORTH_SOUTH';

    networkDecision[jId] = evaluateSingleJunction(jCounts, emergencyDir, currentActive, rotatingJunction === jId);
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
  SAFE_PHASES,
  SIGNAL_CONFIG,
  PRIORITY_WEIGHTS,
  MAX_WAIT_TIME,
  EMERGENCY_GREEN_TIME,
  calculateDirectionPriority,
  calculatePhasePriority,
  checkStarvation,
  calculateGreenDuration,
  handleEmergencyVehicle,
  selectBestPhase,
  transitionSignal,
  evaluateSafeIntersection,
  evaluateSingleJunction,
  calculate16SignalNetworkDecision
};
