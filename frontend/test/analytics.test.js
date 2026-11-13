import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAnalyticsModel, buildHistorySeries } from '../src/analytics.js';

const junctions = [
  { id: 'db-j1', code: 'J1', name: 'Junction 1' },
  { id: 'db-j2', code: 'J2', name: 'Junction 2' },
  { id: 'db-j3', code: 'J3', name: 'Junction 3' },
  { id: 'db-j4', code: 'J4', name: 'Junction 4' }
];

test('normalizes analytics aggregates into four complete junction rows', () => {
  const model = buildAnalyticsModel({
    totalTrafficRecords: 2,
    trafficByJunctionDirection: [
      { junctionId: 'db-j1', direction: 'NORTH', _count: { _all: 2 }, _sum: { vehicleCount: 40 } }
    ],
    densityDistribution: [{ trafficTier: 'HIGH', _count: { _all: 2 } }],
    signalDecisionCount: 3,
    emergencyDispatchCount: 1
  }, junctions);

  assert.equal(model.summary.totalVehicles, 40);
  assert.equal(model.junctions.length, 4);
  assert.equal(model.junctions[0].directions.NORTH.volume, 40);
  assert.equal(model.junctions[3].directions.WEST.volume, 0);
  assert.equal(model.density.find((item) => item.tier === 'LOW').records, 0);
});

test('returns no history chart when records contain only one timestamp', () => {
  assert.deepEqual(buildHistorySeries([
    { capturedAt: '2026-11-14T10:00:00.000Z', vehicleCount: 12 }
  ]), []);
});
