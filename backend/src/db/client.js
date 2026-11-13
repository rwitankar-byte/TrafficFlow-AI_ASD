require('dotenv').config();
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('../generated/prisma/client.cts');

let client;

function getPrisma() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for database access');
  }

  if (!client) {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
    client = new PrismaClient({ adapter });
  }

  return client;
}

async function disconnectPrisma() {
  if (client) await client.$disconnect();
}

module.exports = { getPrisma, disconnectPrisma };
