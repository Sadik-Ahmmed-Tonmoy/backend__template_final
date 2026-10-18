import { PrismaClient } from '@prisma/client';

// Single Prisma instance with password omitted from user queries by default.
// For queries where you explicitly need the password field (e.g. login),
// use: prisma.$extends() or cast with (prisma as PrismaClient)
const prisma = new PrismaClient({
  omit: {
    user: {
      password: true,
    },
  },
  transactionOptions: {
    maxWait: 10_000,
    timeout: 15_000,
  },
});

async function connectPrisma(): Promise<void> {
  try {
    await prisma.$connect();
    console.info('✅ Database connected');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}

connectPrisma();

export const prismaRaw = new PrismaClient({
  transactionOptions: {
    maxWait: 10_000,
    timeout: 15_000,
  },
});

export default prisma;
