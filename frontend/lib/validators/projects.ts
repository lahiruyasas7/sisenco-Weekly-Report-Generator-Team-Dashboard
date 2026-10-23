import { z } from 'zod';

export const projectSchema = z.object({
  name: z.string().trim().min(1, 'Project name is required.'),
  description: z
    .string()
    .trim()
    .max(1000, 'Description must be 1000 characters or fewer.'),
  color: z
    .string()
    .trim()
    .refine((value) => value === '' || /^#[\da-fA-F]{6}$/.test(value), {
      message: 'Use a six-digit hex color, such as #0C7C72.',
    }),
});

export type ProjectFormValues = z.infer<typeof projectSchema>;
