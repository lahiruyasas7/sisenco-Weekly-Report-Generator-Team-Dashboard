import { z } from 'zod';

export const updateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter your name.')
    .max(100, 'Name must be 100 characters or fewer.'),
});

export const adminCreateUserSchema = z.object({
  name: updateProfileSchema.shape.name,
  email: z
    .string()
    .trim()
    .email('Enter a valid email address.')
    .max(254, 'Email must be 254 characters or fewer.'),
  role: z.enum(['MEMBER', 'MANAGER', 'ADMIN']),
  temporaryPassword: z.string().refine((value) => {
    const bytes = new TextEncoder().encode(value).length;
    return bytes >= 15 && bytes <= 72;
  }, 'Temporary password must be 15–72 bytes.'),
});

export const adminUpdateUserSchema = z.object({
  name: updateProfileSchema.shape.name,
  role: z.enum(['MEMBER', 'MANAGER', 'ADMIN']),
});
