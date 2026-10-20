import { z } from 'zod';

function isWithinUtf8ByteRange(
  value: string,
  minimum: number,
  maximum: number,
) {
  const byteLength = new TextEncoder().encode(value).length;
  return byteLength >= minimum && byteLength <= maximum;
}

const emailSchema = z
  .string()
  .trim()
  .email('Enter a valid email address.')
  .max(254, 'Email must be 254 characters or fewer.');

export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .refine(
      (value) => isWithinUtf8ByteRange(value, 1, 72),
      'Password must be 1–72 bytes.',
    ),
});

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Enter your name.')
      .max(100, 'Name must be 100 characters or fewer.'),
    email: emailSchema,
    password: z
      .string()
      .min(12, 'Password must be at least 12 characters.')
      .max(72, 'Password must be 72 characters or fewer.')
      .refine(
        (value) => isWithinUtf8ByteRange(value, 12, 72),
        'Password must be 12–72 bytes.',
      )
      .refine((value) => /\S/.test(value), 'Password cannot be only spaces.'),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .refine(
        (value) => isWithinUtf8ByteRange(value, 1, 72),
        'Current password must be 1–72 bytes.',
      ),
    newPassword: z
      .string()
      .refine(
        (value) => isWithinUtf8ByteRange(value, 15, 72),
        'New password must be 15–72 bytes.',
      ),
    confirmPassword: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  });
