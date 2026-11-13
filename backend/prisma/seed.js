require('dotenv').config();

const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('../src/generated/prisma/client.cts');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for seeding');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL
  })
});

async function main() {
  const junctions = [
    ['J1', 'Junction 1', 'North-West (Grand Ave)', 180, 130],
    ['J2', 'Junction 2', 'North-East (Metro Blvd)', 440, 130],
    ['J3', 'Junction 3', 'South-West (Outer Ring)', 180, 310],
    ['J4', 'Junction 4', 'South-East (Expressway)', 440, 310]
  ];

  const directions = ['NORTH', 'SOUTH', 'EAST', 'WEST'];

  for (const [code, name, label, mapX, mapY] of junctions) {
    const junction = await prisma.junction.upsert({
      where: { code },
      update: { name, label, mapX, mapY },
      create: { code, name, label, mapX, mapY }
    });

    for (const direction of directions) {
      await prisma.signal.upsert({
        where: {
          junctionId_direction: {
            junctionId: junction.id,
            direction
          }
        },
        update: {},
        create: {
          junctionId: junction.id,
          direction,
          state: 'RED'
        }
      });
    }
  }

  await prisma.hospital.upsert({
    where: { code: 'HOSPITAL' },
    update: { name: 'City Hospital' },
    create: { code: 'HOSPITAL', name: 'City Hospital' }
  });

  console.log('Seed completed successfully!');
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });