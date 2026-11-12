const {
  SAFE_PHASES,
  SIGNAL_CONFIG,
  MAX_WAIT_TIME,
  calculateDirectionPriority,
  calculatePhasePriority,
  selectBestPhase,
  calculateGreenDuration,
  checkStarvation,
  handleEmergencyVehicle,
  transitionSignal,
  evaluateSafeIntersection
} = require('../src/algorithms/trafficDecision');

console.log('===============================================================');
console.log('RUNNING COMPREHENSIVE TESTS: SAFE ADAPTIVE TRAFFIC SIGNAL SYSTEM');
console.log('===============================================================\n');

let allPassed = true;
function assert(desc, condition) {
  if (condition) {
    console.log(`✅ PASS: ${desc}`);
  } else {
    console.error(`❌ FAIL: ${desc}`);
    allPassed = false;
  }
}

// -----------------------------------------------------------------------------
// Test 1 — Normal Traffic (North/South highest -> NORTH_SOUTH green)
// -----------------------------------------------------------------------------
console.log('--- TEST 1: Normal Traffic ---');
const t1 = evaluateSafeIntersection({
  trafficData: {
    north: { vehicleCount: 30, waitingTime: 10, congestionLevel: 2 },
    south: { vehicleCount: 25, waitingTime: 15, congestionLevel: 2 },
    east:  { vehicleCount: 5,  waitingTime: 5,  congestionLevel: 1 },
    west:  { vehicleCount: 4,  waitingTime: 5,  congestionLevel: 1 }
  },
  currentPhase: 'NORTH_SOUTH',
  currentSignalState: 'GREEN'
});
assert('Target Phase is NORTH_SOUTH', t1.targetPhase === 'NORTH_SOUTH');
assert('North signal is GREEN', t1.directions.north.signal === 'GREEN');
assert('South signal is GREEN', t1.directions.south.signal === 'GREEN');
assert('East signal is RED', t1.directions.east.signal === 'RED');
assert('West signal is RED', t1.directions.west.signal === 'RED');

// -----------------------------------------------------------------------------
// Test 2 — East/West Congestion (East/West heavily congested -> EAST_WEST green)
// -----------------------------------------------------------------------------
console.log('\n--- TEST 2: East/West Congestion ---');
const t2 = evaluateSafeIntersection({
  trafficData: {
    north: { vehicleCount: 5,  waitingTime: 10, congestionLevel: 1 },
    south: { vehicleCount: 5,  waitingTime: 10, congestionLevel: 1 },
    east:  { vehicleCount: 45, waitingTime: 25, congestionLevel: 3 },
    west:  { vehicleCount: 40, waitingTime: 20, congestionLevel: 3 }
  },
  currentPhase: 'EAST_WEST',
  currentSignalState: 'GREEN'
});
assert('Target Phase is EAST_WEST', t2.targetPhase === 'EAST_WEST');
assert('East signal is GREEN', t2.directions.east.signal === 'GREEN');
assert('West signal is GREEN', t2.directions.west.signal === 'GREEN');
assert('North signal is RED', t2.directions.north.signal === 'RED');
assert('South signal is RED', t2.directions.south.signal === 'RED');

// -----------------------------------------------------------------------------
// Test 3 — Dynamic Timing (Heavy traffic longer, Light traffic shorter)
// -----------------------------------------------------------------------------
console.log('\n--- TEST 3: Dynamic Timing Clamping ---');
const heavyDuration = calculateGreenDuration(120); // very high priority score
const minDuration = calculateGreenDuration(0);     // 0 priority score
assert('Heavy traffic green clamped at maxGreenTime (60s)', heavyDuration === 60);
assert('Zero/Light traffic green clamped at minGreenTime (15s)', minDuration === 15);

const medDuration = calculateGreenDuration(40);
assert('Medium traffic duration adapts proportionally (35s)', medDuration === 35);

// -----------------------------------------------------------------------------
// Test 4 — Starvation Prevention (waitingTime >= MAX_WAIT_TIME)
// -----------------------------------------------------------------------------
console.log('\n--- TEST 4: Starvation Prevention ---');
// Even if NS has 100 cars, if East has waited 65 seconds (>= 60s), EAST_WEST gets emergency priority
const t4 = evaluateSafeIntersection({
  trafficData: {
    north: { vehicleCount: 60, waitingTime: 10, congestionLevel: 3 },
    south: { vehicleCount: 50, waitingTime: 10, congestionLevel: 3 },
    east:  { vehicleCount: 10, waitingTime: 65, congestionLevel: 1 }, // Starved!
    west:  { vehicleCount: 5,  waitingTime: 10, congestionLevel: 1 }
  },
  currentPhase: 'NORTH_SOUTH',
  currentSignalState: 'GREEN'
});
assert('Starvation detected', t4.starvationActive === true);
assert('Starved direction is east', t4.starvedDirection === 'east');
assert('Target phase overridden to EAST_WEST', t4.targetPhase === 'EAST_WEST');

// -----------------------------------------------------------------------------
// Test 5 — Ambulance During Normal Green (Transition: GREEN -> YELLOW -> ALL_RED -> NEW GREEN)
// -----------------------------------------------------------------------------
console.log('\n--- TEST 5: Ambulance During Conflicting Green Transition ---');
// Step 5.1: Ambulance on East, currently NORTH_SOUTH is GREEN
const t5_step1 = evaluateSafeIntersection({
  trafficData: { north: 20, south: 20, east: 5, west: 5 },
  currentPhase: 'NORTH_SOUTH',
  currentSignalState: 'GREEN',
  emergency: { emergencyVehicle: true, direction: 'east' }
});
assert('Emergency mode active', t5_step1.emergencyMode === true);
assert('Target phase is EAST_WEST', t5_step1.targetPhase === 'EAST_WEST');
assert('Signal state transitions to YELLOW clearance', t5_step1.signalState === 'YELLOW');
assert('Duration is yellowTime (3s)', t5_step1.duration === SIGNAL_CONFIG.yellowTime);

// Step 5.2: Next tick while YELLOW -> transitions to ALL_RED
const t5_step2 = transitionSignal('NORTH_SOUTH', 'EAST_WEST', 'YELLOW');
assert('Signal state transitions from YELLOW to ALL_RED clearance', t5_step2.signalState === 'ALL_RED');
assert('Duration is allRedTime (2s)', t5_step2.duration === SIGNAL_CONFIG.allRedTime);

// Step 5.3: Next tick while ALL_RED -> safely grants EAST_WEST GREEN
const t5_step3 = transitionSignal('NORTH_SOUTH', 'EAST_WEST', 'ALL_RED');
assert('Signal state safely reaches target phase EAST_WEST in GREEN', t5_step3.phase === 'EAST_WEST' && t5_step3.signalState === 'GREEN');

// -----------------------------------------------------------------------------
// Test 6 — Ambulance Already Has Green
// -----------------------------------------------------------------------------
console.log('\n--- TEST 6: Ambulance Already Has Green ---');
const t6 = evaluateSafeIntersection({
  trafficData: { north: 10, south: 10, east: 20, west: 20 },
  currentPhase: 'EAST_WEST',
  currentSignalState: 'GREEN',
  emergency: { emergencyVehicle: true, direction: 'east' }
});
assert('Maintains EAST_WEST phase', t6.currentPhase === 'EAST_WEST');
assert('Maintains GREEN signalState', t6.signalState === 'GREEN');
assert('Emergency Mode is TRUE', t6.emergencyMode === true);
assert('Duration is emergency green duration (45s)', t6.duration === 45);

// -----------------------------------------------------------------------------
// Test 7 — Safety Validation (No conflicting greens, no all-green)
// -----------------------------------------------------------------------------
console.log('\n--- TEST 7: Safety Validation ---');

// Test NORTH_SOUTH active green phase
const resNS = evaluateSafeIntersection({
  trafficData: { north: 30, south: 20, east: 5, west: 5 },
  currentPhase: 'NORTH_SOUTH',
  currentSignalState: 'GREEN'
});
const greenDirsNS = Object.entries(resNS.directions)
  .filter(([_, d]) => d.signal === 'GREEN')
  .map(([dir]) => dir);

assert('Phase NORTH_SOUTH only activates North & South as GREEN', 
  greenDirsNS.includes('north') && greenDirsNS.includes('south') && !greenDirsNS.includes('east') && !greenDirsNS.includes('west')
);
assert('Never all 4 directions green simultaneously in NORTH_SOUTH', greenDirsNS.length < 4);

// Test EAST_WEST active green phase
const resEW = evaluateSafeIntersection({
  trafficData: { north: 5, south: 5, east: 30, west: 20 },
  currentPhase: 'EAST_WEST',
  currentSignalState: 'GREEN'
});
const greenDirsEW = Object.entries(resEW.directions)
  .filter(([_, d]) => d.signal === 'GREEN')
  .map(([dir]) => dir);

assert('Phase EAST_WEST only activates East & West as GREEN', 
  greenDirsEW.includes('east') && greenDirsEW.includes('west') && !greenDirsEW.includes('north') && !greenDirsEW.includes('south')
);
assert('Never all 4 directions green simultaneously in EAST_WEST', greenDirsEW.length < 4);

console.log('\n---------------------------------------------------------------');
if (allPassed) {
  console.log('🎉 ALL 7 TEST SCENARIOS PASSED WITH 100% SUCCESS!');
} else {
  console.error('❌ SOME TESTS FAILED');
  process.exit(1);
}
console.log('---------------------------------------------------------------\n');
