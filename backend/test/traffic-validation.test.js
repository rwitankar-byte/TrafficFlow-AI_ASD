const test = require('node:test');
const assert = require('node:assert/strict');
const { validateTrafficPayload } = require('../src/controllers/trafficValidation.js');

test('rejects non-finite vehicle counts', () => {
  assert.throws(
    () => validateTrafficPayload({ networkVehicles: { J1: { north: Infinity } } }),
    /finite non-negative number/
  );
});

test('accepts the existing four-junction payload shape', () => {
  assert.doesNotThrow(() => validateTrafficPayload({
    networkVehicles: {
      J1: { north: 1, south: 2, east: 3, west: 4 },
      J2: { north: 1, south: 2, east: 3, west: 4 },
      J3: { north: 1, south: 2, east: 3, west: 4 },
      J4: { north: 1, south: 2, east: 3, west: 4 }
    }
  }));
});
