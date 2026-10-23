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

export const REPORT_ROW_LIMITS = {
  tasks: 50,
  nextWeekTasks: 50,
  blockers: 20,
  achievements: 20,
  timeEntries: 6,
  links: 20,
} as const;

const quarterHourSchema = z.number().min(0).multipleOf(0.25);

const taskSchema = z.object({
  name: z
    .string()
    .trim()
    .max(200, 'Task name must be 200 characters or fewer.'),
  priority: prioritySchema,
  plannedPercent: z.number().int().min(0).max(100),
  actualPercent: z.number().int().min(0).max(100),
  status: taskStatusSchema,
  plannedHours: quarterHourSchema,
  spentHours: quarterHourSchema,
  output: z.string().max(1000, 'Output must be 1000 characters or fewer.'),
});

const nextWeekTaskSchema = z.object({
  description: z
    .string()
    .trim()
    .max(1000, 'Description must be 1000 characters or fewer.'),
  priority: prioritySchema,
  estimatedHours: quarterHourSchema.nullable(),
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
  hours: quarterHourSchema,
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
    tasks: z
      .array(taskSchema)
      .max(REPORT_ROW_LIMITS.tasks, 'You can add at most 50 tasks.'),
    nextWeekTasks: z
      .array(nextWeekTaskSchema)
      .max(
        REPORT_ROW_LIMITS.nextWeekTasks,
        'You can add at most 50 next-week tasks.',
      ),
    blockers: z
      .array(blockerSchema)
      .max(REPORT_ROW_LIMITS.blockers, 'You can add at most 20 blockers.'),
    achievements: z
      .array(achievementSchema)
      .max(
        REPORT_ROW_LIMITS.achievements,
        'You can add at most 20 achievements.',
      ),
    timeEntries: z
      .array(timeEntrySchema)
      .max(
        REPORT_ROW_LIMITS.timeEntries,
        'You can add at most 6 time entries.',
      ),
    notes: z.string().max(5000, 'Notes must be 5000 characters or fewer.'),
    links: z
      .array(
        z
          .string()
          .max(2000, 'Links must be 2000 characters or fewer.')
          .refine(isHttpUrl, 'Enter a valid http(s) URL.'),
      )
      .max(REPORT_ROW_LIMITS.links, 'You can add at most 20 links.'),
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
      return (
        Number.isFinite(date.valueOf()) &&
        date.toISOString().slice(0, 10) === value &&
        date.getUTCDay() === 1
      );
    }, 'Choose a Monday for the start of the report week.')
    .refine(
      (value) => value <= getCurrentWeekStart(),
      'A report cannot be created for a future week.',
    ),
  projectId: z.string(),
});

export type CreateReportValues = z.infer<typeof createReportSchema>;
