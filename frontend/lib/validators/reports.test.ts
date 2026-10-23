import { describe, expect, it } from 'vitest';
import {
  createReportSchema,
  reportDraftSchema,
  reportSubmitSchema,
} from '@/lib/validators/reports';

const emptyDraft = {
  projectId: '',
  tasks: [],
  nextWeekTasks: [],
  blockers: [],
  achievements: [],
  timeEntries: [],
  notes: '',
  links: [],
};

describe('report validators', () => {
  it('allows an incomplete projectless draft', () => {
    expect(reportDraftSchema.safeParse(emptyDraft).success).toBe(true);
    expect(reportSubmitSchema.safeParse(emptyDraft).success).toBe(false);
  });

  it('checks the fixed task field bounds and supported enums', () => {
    const result = reportDraftSchema.safeParse({
      ...emptyDraft,
      tasks: [
        {
          name: 'x'.repeat(201),
          priority: 'URGENT',
          plannedPercent: 101,
          actualPercent: 0,
          status: 'IN_PROGRESS',
          plannedHours: -1,
          spentHours: 0,
          output: '',
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('enforces one key blocker, one key achievement, and unique time types', () => {
    const result = reportDraftSchema.safeParse({
      ...emptyDraft,
      blockers: [
        { description: '', isKey: true, isResolved: false },
        { description: '', isKey: true, isResolved: false },
      ],
      achievements: [
        { description: '', isKey: true },
        { description: '', isKey: true },
      ],
      timeEntries: [
        { taskType: 'DEVELOPMENT', hours: 1 },
        { taskType: 'DEVELOPMENT', hours: 2 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('requires valid week starts and only http(s) links', () => {
    expect(
      createReportSchema.safeParse({ weekStart: '2026-10-20', projectId: '' })
        .success,
    ).toBe(false);
    expect(
      reportDraftSchema.safeParse({
        ...emptyDraft,
        links: ['javascript:alert(1)'],
      }).success,
    ).toBe(false);
  });

  it('requires a project, a named task, and descriptions before submission', () => {
    const result = reportSubmitSchema.safeParse({
      ...emptyDraft,
      tasks: [
        {
          name: '  ',
          priority: 'MEDIUM',
          plannedPercent: 0,
          actualPercent: 0,
          status: 'IN_PROGRESS',
          plannedHours: 0,
          spentHours: 0,
          output: '',
        },
      ],
      blockers: [{ description: '', isKey: false, isResolved: false }],
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    const messages = result.error.issues.map(({ message }) => message);
    expect(messages).toContain('Choose a project before submitting.');
    expect(messages).toContain('Enter a task name before submitting.');
    expect(messages).toContain('Add a description before submitting.');
  });
});
