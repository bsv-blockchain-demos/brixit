/**
 * Creates the system superuser used for auto-verification and patches AUTO_VERIFY_USER_ID in .env.
 *
 * Usage:
 *   npm run create-superuser        (from backend/)
 *   npx tsx scripts/create-superuser.ts
 *
 * Safe to re-run — uses upsert so it won't create duplicates.
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });
const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = resolve(__dirname, '../.env');

async function main() {
  // Upsert the system user
  const user = await prisma.user.upsert({
    where: { email: 'system@brixit.internal' },
    update: {},
    create: {
      email: 'system@brixit.internal',
      displayName: 'System',
    },
  });

  // Upsert the admin role
  await prisma.userRole.upsert({
    where: { userId_role: { userId: user.id, role: 'admin' } },
    update: {},
    create: { userId: user.id, role: 'admin' },
  });

  // Container mode: print bare UUID and exit (entrypoint.sh captures it)
  if (process.env.PRINT_ID_ONLY === '1') {
    console.log(user.id);
    return;
  }

  console.log('\n✅ System superuser ready');
  console.log(`   ID:    ${user.id}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Role:  admin\n`);

  // Patch .env
  if (!existsSync(ENV_PATH)) {
    console.log(`⚠️  Could not find .env at ${ENV_PATH}`);
    console.log(`   Manually set: AUTO_VERIFY_USER_ID=${user.id}`);
    return;
  }

  const env = readFileSync(ENV_PATH, 'utf-8');

  if (env.includes(`AUTO_VERIFY_USER_ID=${user.id}`)) {
    console.log('ℹ️  .env already has the correct AUTO_VERIFY_USER_ID — nothing to update.');
    return;
  }

  const patched = env.replace(
    /^AUTO_VERIFY_USER_ID=.*$/m,
    `AUTO_VERIFY_USER_ID=${user.id}`,
  );

  writeFileSync(ENV_PATH, patched, 'utf-8');
  console.log(`✅ Patched backend/.env → AUTO_VERIFY_USER_ID=${user.id}\n`);
}

main()
  .catch((err) => {
    console.error('❌ Error:', err.message ?? err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
