const { getPrisma, isPostgresConfigured } = require('../db/client.js');
const { beginnerDb } = require('../db/beginnerDb.js');

function limitFrom(query) {
  const value = Number(query.limit || 100);
  if (!Number.isInteger(value) || value < 1 || value > 500) return 100;
  return value;
}

/**
 * Check Database Connection Status & Available Mode
 * GET /api/database/status
 */
async function getDatabaseStatus(req, res) {
  const isPg = isPostgresConfigured();
  const dates = beginnerDb.getAvailableDates();
  res.json({
    status: 'success',
    databaseMode: isPg ? 'PostgreSQL (Prisma)' : 'Beginner-Friendly Local Database',
    isPostgresConnected: isPg,
    totalRecords: beginnerDb.trafficData.length,
    availableDates: dates,
    storage: isPg ? 'PostgreSQL Database' : 'Zero-Setup In-Memory & Local JSON',
    features: [
      'Query traffic by date and time',
      'Analyze and rank peak rush traffic dates',
      'Historical signal state audit logs',
      'Emergency ambulance dispatch records'
    ]
  });
}

/**
 * Get Junctions
 * GET /api/junctions
 */
async function getJunctions(req, res) {
  try {
    if (isPostgresConfigured()) {
      const junctions = await getPrisma().junction.findMany({ orderBy: { code: 'asc' }, include: { signals: true } });
      return res.json({ status: 'success', junctions });
    }
  } catch (err) {
    // fallback to beginnerDb
  }
  return res.json({ status: 'success', junctions: beginnerDb.getJunctions() });
}

/**
 * Get Traffic History with Date, Hour, and Junction Filters
 * GET /api/traffic/history?date=YYYY-MM-DD&hour=HH&junctionId=J1&limit=100
 */
async function getTrafficHistory(req, res) {
  const limit = limitFrom(req.query);
  const date = req.query.date || null;
  const hour = req.query.hour !== undefined ? Number(req.query.hour) : null;
  const junction = req.query.junctionId || req.query.junctionCode || null;

  try {
    if (isPostgresConfigured()) {
      const records = await getPrisma().trafficData.findMany({
        where: {
          ...(junction ? { junctionId: junction } : {}),
          ...(date ? { capturedAt: { gte: new Date(`${date}T00:00:00Z`), lte: new Date(`${date}T23:59:59Z`) } } : {})
        },
        orderBy: { capturedAt: 'desc' },
        take: limit
      });
      return res.json({ status: 'success', total: records.length, records });
    }
  } catch (err) {
    // fallback to beginnerDb
  }

  const records = beginnerDb.getTrafficHistory({ limit, junctionCode: junction, date, hour });
  return res.json({ status: 'success', total: records.length, records });
}

/**
 * Check Traffic by Date and Time
 * GET /api/traffic/by-date?date=YYYY-MM-DD&hour=HH&junction=J1
 */
async function getTrafficByDate(req, res) {
  try {
    const date = req.query.date || null;
    const hour = req.query.hour !== undefined && req.query.hour !== '' ? Number(req.query.hour) : null;
    const junction = req.query.junction || req.query.junctionCode || null;

    const snapshot = beginnerDb.getTrafficByDateTime({ date, hour, junctionCode: junction });
    res.json({
      status: 'success',
      query: { date, hour, junction },
      ...snapshot
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
}

/**
 * Analyze and Rank Dates with Rush Traffic
 * GET /api/traffic/rush-dates
 */
async function getRushTrafficDates(req, res) {
  try {
    const report = beginnerDb.getRushTrafficReport();
    res.json(report);
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
}

/**
 * Current Signals
 * GET /api/signals/current
 */
async function getCurrentSignals(req, res) {
  try {
    if (isPostgresConfigured()) {
      const signals = await getPrisma().signal.findMany({ orderBy: [{ junctionId: 'asc' }, { direction: 'asc' }], include: { junction: true } });
      return res.json({ status: 'success', signals });
    }
  } catch (err) {
    // fallback
  }

  // Generate fallback current signals from junctions
  const signals = [];
  for (const j of beginnerDb.getJunctions()) {
    for (const dir of ['NORTH', 'SOUTH', 'EAST', 'WEST']) {
      signals.push({
        id: `sig_${j.code}_${dir}`,
        junctionId: j.id,
        junctionCode: j.code,
        direction: dir,
        state: (dir === 'NORTH' || dir === 'SOUTH') ? 'GREEN' : 'RED',
        isEmergency: false
      });
    }
  }
  res.json({ status: 'success', signals });
}

/**
 * Signal Transition History
 * GET /api/signals/history
 */
async function getSignalHistory(req, res) {
  const limit = limitFrom(req.query);
  try {
    if (isPostgresConfigured()) {
      const logs = await getPrisma().signalLog.findMany({ orderBy: { occurredAt: 'desc' }, take: limit, include: { signal: true } });
      return res.json({ status: 'success', logs });
    }
  } catch (err) {
    // fallback
  }
  res.json({ status: 'success', logs: beginnerDb.signalLogs.slice(-limit).reverse() });
}

/**
 * Emergency Ambulance History
 * GET /api/emergency/history
 */
async function getEmergencyHistory(req, res) {
  const limit = limitFrom(req.query);
  try {
    if (isPostgresConfigured()) {
      const dispatches = await getPrisma().emergencyDispatch.findMany({ orderBy: { startedAt: 'desc' }, take: limit, include: { hospital: true, startJunction: true, currentJunction: true } });
      return res.json({ status: 'success', dispatches });
    }
  } catch (err) {
    // fallback
  }
  res.json({ status: 'success', dispatches: beginnerDb.emergencyDispatches.slice(-limit).reverse() });
}

/**
 * Traffic Analytics Summary
 * GET /api/analytics
 */
async function getAnalytics(req, res) {
  try {
    if (isPostgresConfigured()) {
      const prisma = getPrisma();
      const [totalTrafficRecords, trafficByJunctionDirection, densityDistribution, signalDecisionCount, emergencyDispatchCount] = await Promise.all([
        prisma.trafficData.count(),
        prisma.trafficData.groupBy({ by: ['junctionId', 'direction'], _count: { _all: true }, _sum: { vehicleCount: true } }),
        prisma.trafficData.groupBy({ by: ['trafficTier'], _count: { _all: true } }),
        prisma.signalLog.count(),
        prisma.emergencyDispatch.count()
      ]);
      return res.json({
        status: 'success',
        analytics: { totalTrafficRecords, trafficByJunctionDirection, densityDistribution, signalDecisionCount, emergencyDispatchCount }
      });
    }
  } catch (err) {
    // fallback
  }

  // Beginner DB Analytics
  const records = beginnerDb.trafficData;
  const tiers = { LOW: 0, MEDIUM: 0, HIGH: 0, VERY_HIGH: 0 };
  for (const r of records) {
    if (tiers[r.trafficTier] !== undefined) tiers[r.trafficTier]++;
  }

  res.json({
    status: 'success',
    mode: 'beginner_friendly_db',
    analytics: {
      totalTrafficRecords: records.length,
      availableDatesCount: beginnerDb.getAvailableDates().length,
      densityDistribution: tiers,
      signalDecisionCount: beginnerDb.signalLogs.length,
      emergencyDispatchCount: beginnerDb.emergencyDispatches.length
    }
  });
}

module.exports = {
  getDatabaseStatus,
  getJunctions,
  getTrafficHistory,
  getTrafficByDate,
  getRushTrafficDates,
  getCurrentSignals,
  getSignalHistory,
  getEmergencyHistory,
  getAnalytics
};
