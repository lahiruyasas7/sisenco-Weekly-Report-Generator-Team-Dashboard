import { z } from 'zod';
import { getCurrentWeekStart } from '@/lib/week';

const prioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const taskStatusSchema = z.enum([
  'COMPLETED',
  'IN_PROGRESS',
  'BLOCKED',
  'DEFERRED',
]);
const taskTypeSchema = z.enum([
  'DEVELOPMENT',
  'TESTING',
  'MEETINGS',
  'DOCUMENTATION',
  'DESIGN',
  'OTHER',
]);

const taskSchema = z.object({
  name: z
    .string()
    .trim()
    .max(200, 'Task name must be 200 characters or fewer.'),
  priority: prioritySchema,
  plannedPercent: z.number().int().min(0).max(100),
  actualPercent: z.number().int().min(0).max(100),
  status: taskStatusSchema,
  plannedHours: z.number().min(0),
  spentHours: z.number().min(0),
  output: z.string().max(1000, 'Output must be 1000 characters or fewer.'),
});

const nextWeekTaskSchema = z.object({
  description: z
    .string()
    .trim()
    .max(1000, 'Description must be 1000 characters or fewer.'),
  priority: prioritySchema,
  estimatedHours: z.number().min(0).nullable(),
});

const blockerSchema = z.object({
  description: z
    .string()
    .trim()
    .max(1000, 'Description must be 1000 characters or fewer.'),
  isKey: z.boolean(),
  isResolved: z.boolean(),
});

const achievementSchema = z.object({
  description: z
    .string()
    .trim()
    .max(1000, 'Description must be 1000 characters or fewer.'),
  isKey: z.boolean(),
});

const timeEntrySchema = z.object({
  taskType: taskTypeSchema,
  hours: z.number().min(0),
});

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export const reportDraftSchema = z
  .object({
    projectId: z.string(),
    tasks: z.array(taskSchema),
    nextWeekTasks: z.array(nextWeekTaskSchema),
    blockers: z.array(blockerSchema),
    achievements: z.array(achievementSchema),
    timeEntries: z.array(timeEntrySchema),
    notes: z.string().max(5000, 'Notes must be 5000 characters or fewer.'),
    links: z
      .array(
        z
          .string()
          .max(2000, 'Links must be 2000 characters or fewer.')
          .refine(isHttpUrl, 'Enter a valid http(s) URL.'),
      )
      .max(20, 'You can add at most 20 links.'),
  })
  .superRefine((values, context) => {
    if (values.blockers.filter(({ isKey }) => isKey).length > 1) {
      context.addIssue({
        code: 'custom',
        path: ['blockers'],
        message: 'Choose at most one key blocker.',
      });
    }
    if (values.achievements.filter(({ isKey }) => isKey).length > 1) {
      context.addIssue({
        code: 'custom',
        path: ['achievements'],
        message: 'Choose at most one key achievement.',
      });
    }
    if (
      new Set(values.timeEntries.map(({ taskType }) => taskType)).size !==
      values.timeEntries.length
    ) {
      context.addIssue({
        code: 'custom',
        path: ['timeEntries'],
        message: 'Each task type can be listed once.',
      });
    }
  });

export const reportSubmitSchema = reportDraftSchema.superRefine(
  (values, context) => {
    if (!values.projectId) {
      context.addIssue({
        code: 'custom',
        path: ['projectId'],
        message: 'Choose a project before submitting.',
      });
    }
    if (values.tasks.length === 0) {
      context.addIssue({
        code: 'custom',
        path: ['tasks'],
        message: 'Add at least one task before submitting.',
      });
    }
    values.tasks.forEach((task, index) => {
      if (!task.name) {
        context.addIssue({
          code: 'custom',
          path: ['tasks', index, 'name'],
          message: 'Enter a task name before submitting.',
        });
      }
    });
    for (const [field, rows] of [
      ['nextWeekTasks', values.nextWeekTasks],
      ['blockers', values.blockers],
      ['achievements', values.achievements],
    ] as const) {
      rows.forEach((row, index) => {
        if (!row.description) {
          context.addIssue({
            code: 'custom',
            path: [field, index, 'description'],
            message: 'Add a description before submitting.',
          });
        }
      });
    }
  },
);

export type ReportFormValues = z.infer<typeof reportDraftSchema>;

export const createReportSchema = z.object({
  weekStart: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid week start date.')
    .refine((value) => {
      const date = new Date(`${value}T00:00:00Z`);
      return !Number.isNaN(date.valueOf()) && date.getUTCDay() === 1;
    }, 'Choose a Monday for the start of the report week.')
    .refine(
      (value) => value <= getCurrentWeekStart(),
      'A report cannot be created for a future week.',
    ),
  projectId: z.string(),
});

export type CreateReportValues = z.infer<typeof createReportSchema>;
