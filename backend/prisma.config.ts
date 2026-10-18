import { config as loadEnv } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

// Keep Prisma CLI environment-file precedence aligned with ConfigModule.
loadEnv({
  path: [`.env.${process.env.NODE_ENV ?? 'development'}`, '.env'],
});

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
