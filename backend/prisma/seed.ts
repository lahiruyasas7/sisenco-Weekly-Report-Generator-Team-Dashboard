import { config as loadEnv } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role } from '../src/generated/prisma/client.js';
import bcrypt from 'bcrypt';
import { BCRYPT_SALT_ROUNDS } from '../src/auth/auth.constants.js';

loadEnv({
  path: [`.env.${process.env.NODE_ENV ?? 'development'}`, '.env'],
});

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be set to seed the admin`);
  return value;
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
if (
  !password ||
  Buffer.byteLength(password, 'utf8') < 15 ||
  Buffer.byteLength(password, 'utf8') > 72
) {
  throw new Error('INITIAL_ADMIN_PASSWORD must be between 15 and 72 bytes');
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

seedAdmin()
  .catch((error: unknown) => {
    console.error('Failed to seed initial admin:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
