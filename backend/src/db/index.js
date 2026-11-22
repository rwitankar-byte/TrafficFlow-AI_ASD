/**
 * backend/src/db/index.js
 * Central unified export for all database operations, clients, and queries.
 */

const client = require('./client.js');
const { beginnerDb } = require('./beginnerDb.js');
const trafficDatabase = require('./trafficDatabase.js');

module.exports = {
  // PostgreSQL / Prisma Client
  getPrisma: client.getPrisma,
  disconnectPrisma: client.disconnectPrisma,
  isPostgresConfigured: client.isPostgresConfigured,

  // Zero-Setup Beginner Local & In-Memory Store
  beginnerDb,

  // Standalone Viva & Production Database Operations
  SAMPLE_TRAFFIC_RECORD: trafficDatabase.SAMPLE_TRAFFIC_RECORD,
  saveTrafficSnapshotTransaction: trafficDatabase.saveTrafficSnapshotTransaction,
  queryTrafficByDateAndTime: trafficDatabase.queryTrafficByDateAndTime,
  findRushTrafficDates: trafficDatabase.findRushTrafficDates
};
