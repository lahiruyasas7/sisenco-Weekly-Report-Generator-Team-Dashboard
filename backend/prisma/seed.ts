import { config as loadEnv } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { DateTime } from 'luxon';
import { PrismaClient, Role } from '../src/generated/prisma/client.js';
import bcrypt from 'bcrypt';
import { BCRYPT_SALT_ROUNDS } from '../src/auth/auth.constants.js';
import { seedDemoData } from './demo-seed.js';

loadEnv({
  path: [`.env.${process.env.NODE_ENV ?? 'development'}`, '.env'],
});

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be set to run the seed command`);
  return value;
}

function validatePassword(name: string, value: string): void {
  const length = Buffer.byteLength(value, 'utf8');
  if (length < 15 || length > 72) {
    throw new Error(`${name} must be between 15 and 72 bytes`);
  }
}

const databaseUrl = requireEnv('DATABASE_URL');
const email = requireEnv('INITIAL_ADMIN_EMAIL').trim().toLowerCase();
const name = requireEnv('INITIAL_ADMIN_NAME').trim();
const password = requireEnv('INITIAL_ADMIN_PASSWORD');

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  throw new Error('INITIAL_ADMIN_EMAIL must be a valid email address');
}
if (!name || name.length > 100) {
  throw new Error('INITIAL_ADMIN_NAME must contain 1 to 100 characters');
}
validatePassword('INITIAL_ADMIN_PASSWORD', password);

const isProduction = process.env.NODE_ENV === 'production';
const demoPassword = isProduction
  ? undefined
  : requireEnv('DEMO_SEED_PASSWORD');
if (demoPassword) validatePassword('DEMO_SEED_PASSWORD', demoPassword);
const timezone = process.env.REPORT_TIMEZONE ?? 'Asia/Colombo';
const parsedDueOffset = Number(process.env.REPORT_DUE_OFFSET_DAYS ?? 7);
if (
  !Number.isInteger(parsedDueOffset) ||
  parsedDueOffset < 0 ||
  parsedDueOffset > 31
) {
  throw new Error('REPORT_DUE_OFFSET_DAYS must be an integer from 0 to 31');
}
if (!DateTime.now().setZone(timezone).isValid) {
  throw new Error('REPORT_TIMEZONE must be a valid IANA timezone');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

async function seedAdmin(): Promise<void> {
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    if (existing.role !== Role.ADMIN || !existing.isActive) {
      throw new Error(
        'The configured admin email already belongs to a non-admin or inactive account',
      );
    }
    console.info('Initial admin already exists; no changes made.');
    return;
  }

  await prisma.user.create({
    data: {
      email,
      name,
      passwordHash: await bcrypt.hash(password, BCRYPT_SALT_ROUNDS),
      role: Role.ADMIN,
    },
  });

  console.info('Initial admin created.');
}

async function seed(): Promise<void> {
  await seedAdmin();
  if (isProduction) {
    console.info('Demo data is disabled in production; no demo data created.');
    return;
  }

  if (!demoPassword) {
    throw new Error('DEMO_SEED_PASSWORD must be set outside production');
  }
  const demoPasswordHash = await bcrypt.hash(demoPassword, BCRYPT_SALT_ROUNDS);
  await seedDemoData(prisma, demoPasswordHash, timezone, parsedDueOffset);
  console.info('Demo manager, members, projects, and reports restored.');
}

seed()
  .catch((error: unknown) => {
    console.error('Failed to seed database:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
