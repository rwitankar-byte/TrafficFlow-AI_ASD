export const ANALYTICS_DIRECTIONS = ['NORTH', 'SOUTH', 'EAST', 'WEST'];
export const ANALYTICS_TIERS = ['LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'];

const FALLBACK_JUNCTIONS = [
  { code: 'J1', name: 'Junction 1' },
  { code: 'J2', name: 'Junction 2' },
  { code: 'J3', name: 'Junction 3' },
  { code: 'J4', name: 'Junction 4' }
];

function asNumber(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function normalizeJunctions(junctions = []) {
  return FALLBACK_JUNCTIONS.map((fallback) => {
    const databaseJunction = junctions.find((junction) => junction.code === fallback.code);
    return {
      ...fallback,
      id: databaseJunction?.id || fallback.code,
      name: databaseJunction?.name || fallback.name
    };
  });
}

export function buildAnalyticsModel(analytics = {}, junctions = []) {
  const knownJunctions = normalizeJunctions(junctions);
  const trafficRows = Array.isArray(analytics.trafficByJunctionDirection)
    ? analytics.trafficByJunctionDirection
    : [];
  const densityRows = Array.isArray(analytics.densityDistribution)
    ? analytics.densityDistribution
    : [];

  const junctionModels = knownJunctions.map((junction) => ({
    ...junction,
    directions: Object.fromEntries(ANALYTICS_DIRECTIONS.map((direction) => {
      const row = trafficRows.find((item) => (
        (item.junctionId === junction.id || item.junctionId === junction.code) &&
        item.direction === direction
      ));
      return [direction, {
        records: asNumber(row?._count?._all),
        volume: asNumber(row?._sum?.vehicleCount)
      }];
    }))
  }));

  const densityTotal = densityRows.reduce((sum, row) => sum + asNumber(row?._count?._all), 0);
  const density = ANALYTICS_TIERS.map((tier) => {
    const row = densityRows.find((item) => item.trafficTier === tier);
    const records = asNumber(row?._count?._all);
    return {
      tier,
      records,
      percentage: densityTotal ? (records / densityTotal) * 100 : 0
    };
  });

  return {
    summary: {
      trafficRecords: asNumber(analytics.totalTrafficRecords),
      signalDecisions: asNumber(analytics.signalDecisionCount),
      emergencyDispatches: asNumber(analytics.emergencyDispatchCount),
      totalVehicles: trafficRows.reduce((sum, row) => sum + asNumber(row?._sum?.vehicleCount), 0)
    },
    density,
    junctions: junctionModels
  };
}

export function buildHistorySeries(records = []) {
  const byTimestamp = new Map();
  for (const record of records) {
    const timestamp = new Date(record?.capturedAt).getTime();
    if (!Number.isFinite(timestamp)) continue;
    const key = new Date(timestamp).toISOString();
    byTimestamp.set(key, (byTimestamp.get(key) || 0) + asNumber(record.vehicleCount));
  }

  const points = [...byTimestamp.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([timestamp, vehicles]) => ({ timestamp, vehicles }));

  return points.length >= 2 ? points : [];
}
