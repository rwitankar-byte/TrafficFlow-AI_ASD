const { getPrisma } = require('../db/client.js');

function limitFrom(query) {
  const value = Number(query.limit || 100);
  if (!Number.isInteger(value) || value < 1 || value > 500) throw new Error('limit must be an integer between 1 and 500');
  return value;
}

async function getJunctions(req, res) {
  const junctions = await getPrisma().junction.findMany({ orderBy: { code: 'asc' }, include: { signals: true } });
  res.json({ status: 'success', junctions });
}

async function getTrafficHistory(req, res) {
  const limit = limitFrom(req.query);
  const where = req.query.junctionId ? { junctionId: req.query.junctionId } : undefined;
  const records = await getPrisma().trafficData.findMany({ where, orderBy: { capturedAt: 'desc' }, take: limit });
  res.json({ status: 'success', records });
}

async function getCurrentSignals(req, res) {
  const signals = await getPrisma().signal.findMany({ orderBy: [{ junctionId: 'asc' }, { direction: 'asc' }], include: { junction: true } });
  res.json({ status: 'success', signals });
}

async function getSignalHistory(req, res) {
  const logs = await getPrisma().signalLog.findMany({ orderBy: { occurredAt: 'desc' }, take: limitFrom(req.query), include: { signal: true } });
  res.json({ status: 'success', logs });
}

async function getEmergencyHistory(req, res) {
  const dispatches = await getPrisma().emergencyDispatch.findMany({ orderBy: { startedAt: 'desc' }, take: limitFrom(req.query), include: { hospital: true, startJunction: true, currentJunction: true } });
  res.json({ status: 'success', dispatches });
}

async function getAnalytics(req, res) {
  const prisma = getPrisma();
  const [totalTrafficRecords, trafficByJunctionDirection, densityDistribution, signalDecisionCount, emergencyDispatchCount] = await Promise.all([
    prisma.trafficData.count(),
    prisma.trafficData.groupBy({ by: ['junctionId', 'direction'], _count: { _all: true }, _sum: { vehicleCount: true } }),
    prisma.trafficData.groupBy({ by: ['trafficTier'], _count: { _all: true } }),
    prisma.signalLog.count(),
    prisma.emergencyDispatch.count()
  ]);
  res.json({ status: 'success', analytics: { totalTrafficRecords, trafficByJunctionDirection, densityDistribution, signalDecisionCount, emergencyDispatchCount } });
}

module.exports = { getJunctions, getTrafficHistory, getCurrentSignals, getSignalHistory, getEmergencyHistory, getAnalytics };
