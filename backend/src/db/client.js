require('dotenv').config();

let client;

function getPrisma() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for database access');
  if (!client) {
    const { PrismaPg } = require('@prisma/adapter-pg');
    const { PrismaClient } = require('@prisma/client');
    client = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  }
  return client;
}

async function disconnectPrisma() {
  if (client) await client.$disconnect();
}

module.exports = { getPrisma, disconnectPrisma };
