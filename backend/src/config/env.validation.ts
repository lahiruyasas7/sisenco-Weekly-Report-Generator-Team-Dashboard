import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  DATABASE_URL: z
    .string()
    .url()
    .refine(
      (url) => url.startsWith('postgres://') || url.startsWith('postgresql://'),
      'DATABASE_URL must be a PostgreSQL connection string',
    ),
  JWT_SECRET: z
    .string()
    .refine(
      (secret) => Buffer.byteLength(secret, 'utf8') >= 32,
      'JWT_SECRET must be at least 32 bytes',
    ),
  FRONTEND_ORIGIN: z
    .string()
    .url()
    .refine((origin) => {
      const parsed = new URL(origin);
      return parsed.origin === origin.replace(/\/$/, '');
    }, 'FRONTEND_ORIGIN must be an origin without a path'),
  REPORT_TIMEZONE: z.string().default('Asia/Colombo'),
  REPORT_DUE_OFFSET_DAYS: z.coerce.number().int().min(0).max(31).default(7),
});

export type Env = z.infer<typeof envSchema>;
