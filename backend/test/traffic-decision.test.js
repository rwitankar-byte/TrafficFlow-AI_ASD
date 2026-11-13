const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyTrafficTier, evaluateSingleJunction } = require('../src/algorithms/trafficDecision.js');

test('keeps the four traffic tier boundaries', () => {
  assert.equal(classifyTrafficTier(19).level, 'LOW');
  assert.equal(classifyTrafficTier(20).level, 'MEDIUM');
  assert.equal(classifyTrafficTier(50).level, 'MEDIUM');
  assert.equal(classifyTrafficTier(51).level, 'HIGH');
  assert.equal(classifyTrafficTier(80).level, 'HIGH');
  assert.equal(classifyTrafficTier(81).level, 'VERY_HIGH');
});

test('keeps all signals red when no vehicles are waiting', () => {
  const decision = evaluateSingleJunction({ north: 0, south: 0, east: 0, west: 0 });
  assert.equal(decision.activeDirection, 'ALL_RED');
  assert.deepEqual(Object.values(decision.directions).map(({ signal }) => signal), ['RED', 'RED', 'RED', 'RED']);
});

test('preempts the requested direction for an emergency', () => {
  const decision = evaluateSingleJunction({ north: 0, south: 10, east: 20, west: 30 }, 'north');
  assert.equal(decision.activeDirection, 'NORTH');
  assert.equal(decision.isEmergency, true);
});
