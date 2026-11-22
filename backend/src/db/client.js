require('dotenv').config();

let client = null;

function isPostgresConfigured() {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== '');
}

function getPrisma() {
  if (!isPostgresConfigured()) {
    throw new Error('DATABASE_URL is required for PostgreSQL access. Using Beginner DB fallback.');
  }
  if (!client) {
    try {
      const { PrismaPg } = require('@prisma/adapter-pg');
      const { PrismaClient } = require('@prisma/client');
      client = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
    } catch (err) {
      console.warn('Prisma client initialization failed:', err.message);
      throw err;
    }
  }
  return client;
}

async function disconnectPrisma() {
  if (client) {
    await client.$disconnect();
    client = null;
  }
}

module.exports = { getPrisma, disconnectPrisma, isPostgresConfigured };
