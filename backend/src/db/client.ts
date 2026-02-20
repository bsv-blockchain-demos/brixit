import { PrismaClient } from '@prisma/client';

// Single Prisma client instance (reused across the app)
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

// Graceful shutdown — close DB connections on process exit
async function shutdown() {
  console.log('\n🔌 Disconnecting Prisma client...');
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export default prisma;
