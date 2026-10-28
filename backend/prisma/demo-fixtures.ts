import { DateTime } from 'luxon';
import {
  Priority,
  ReportStatus,
  ReviewAction,
  TaskStatus,
  TaskType,
} from '../src/generated/prisma/client.js';

export const DEMO_PROJECTS = [
  { id: 'd0000000-0000-4000-8000-000000000001', name: 'Client A' },
  { id: 'd0000000-0000-4000-8000-000000000002', name: 'Client B' },
  {
    id: 'd0000000-0000-4000-8000-000000000003',
    name: 'Internal Tooling',
  },
  { id: 'd0000000-0000-4000-8000-000000000004', name: 'R&D' },
  { id: 'd0000000-0000-4000-8000-000000000005', name: 'Marketing' },
] as const;

export const DEMO_USERS = [
  {
    id: 'd1000000-0000-4000-8000-000000000001',
    email: 'demo.manager@example.test',
    name: 'Asha Perera',
    role: 'MANAGER',
  },
  {
    id: 'd1000000-0000-4000-8000-000000000002',
    email: 'demo.member1@example.test',
    name: 'Nuwan Silva',
    role: 'MEMBER',
  },
  {
    id: 'd1000000-0000-4000-8000-000000000003',
    email: 'demo.member2@example.test',
    name: 'Kavindi Fernando',
    role: 'MEMBER',
  },
  {
    id: 'd1000000-0000-4000-8000-000000000004',
    email: 'demo.member3@example.test',
    name: 'Dilan Perera',
    role: 'MEMBER',
  },
  {
    id: 'd1000000-0000-4000-8000-000000000005',
    email: 'demo.member4@example.test',
    name: 'Sachini Jayawardena',
    role: 'MEMBER',
  },
  {
    id: 'd1000000-0000-4000-8000-000000000006',
    email: 'demo.member5@example.test',
    name: 'Tharindu Silva',
    role: 'MEMBER',
  },
] as const;

export type DemoReportContent = {
  weekStart: string;
  weekEnd: string;
  project: { id: string; name: string };
  tasks: {
    name: string;
    priority: Priority;
    plannedPercent: number;
    actualPercent: number;
    status: TaskStatus;
    plannedHours: number;
    spentHours: number;
    output: string;
  }[];
  nextWeekTasks: {
    description: string;
    priority: Priority;
    estimatedHours: number;
  }[];
  blockers: {
    description: string;
    isKey: boolean;
    isResolved: boolean;
  }[];
  achievements: { description: string; isKey: boolean }[];
  timeEntries: { taskType: TaskType; hours: number }[];
  notes: string;
  links: string[];
};

export type DemoReviewFixture = {
  action: ReviewAction;
  comment: string | null;
  createdAt: Date;
  reviewerId: string;
};

export type DemoVersionFixture = {
  versionNumber: number;
  submittedAt: Date;
  snapshot: DemoReportContent;
  review: DemoReviewFixture | null;
};

export type DemoReportFixture = {
  userId: string;
  projectId: string;
  weekStart: Date;
  weekEnd: Date;
  status: ReportStatus;
  currentVersion: number;
  submittedAt: Date | null;
  firstSubmittedAt: Date | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  content: DemoReportContent;
  versions: DemoVersionFixture[];
};

function isoDate(date: DateTime): string {
  const value = date.toISODate();
  if (!value) throw new Error('Unable to format demo report date');
  return value;
}

function utcDatabaseDate(date: DateTime): Date {
  return DateTime.fromISO(isoDate(date), { zone: 'utc' }).toJSDate();
}

function reportStatus(weekOffset: number, memberIndex: number): ReportStatus {
  if (weekOffset === 0) {
    return [
      ReportStatus.DRAFT,
      ReportStatus.SUBMITTED,
      ReportStatus.APPROVED,
      ReportStatus.DRAFT,
      ReportStatus.SUBMITTED,
    ][memberIndex];
  }
  if (weekOffset === 1) {
    return [
      ReportStatus.NEEDS_CORRECTION,
      ReportStatus.APPROVED,
      ReportStatus.SUBMITTED,
      ReportStatus.APPROVED,
      ReportStatus.APPROVED,
    ][memberIndex];
  }
  if (weekOffset === 2) {
    return [
      ReportStatus.APPROVED,
      ReportStatus.APPROVED,
      ReportStatus.NEEDS_CORRECTION,
      ReportStatus.SUBMITTED,
      ReportStatus.APPROVED,
    ][memberIndex];
  }
  return ReportStatus.APPROVED;
}

function versionCount(
  status: ReportStatus,
  weekOffset: number,
  memberIndex: number,
): number {
  if (status === ReportStatus.DRAFT) return 0;
  if (
    (weekOffset === 1 && memberIndex === 0) ||
    (weekOffset === 3 && memberIndex === 2)
  ) {
    return 3;
  }
  if (
    status === ReportStatus.NEEDS_CORRECTION ||
    (status === ReportStatus.SUBMITTED && weekOffset === 2 && memberIndex === 3)
  ) {
    return 2;
  }
  if (
    status === ReportStatus.APPROVED &&
    ((weekOffset === 3 && memberIndex === 0) ||
      (weekOffset === 5 && memberIndex === 4))
  ) {
    return 2;
  }
  return 1;
}

function contentFor(
  weekStart: DateTime,
  weekEnd: DateTime,
  project: (typeof DEMO_PROJECTS)[number],
  memberIndex: number,
  weekOffset: number,
  versionNumber: number,
): DemoReportContent {
  const label = `${DEMO_USERS[memberIndex + 1].name} week ${8 - weekOffset}`;
  const blockers =
    (weekOffset === 0 && memberIndex === 2) ||
    (weekOffset === 1 && memberIndex === 0) ||
    (weekOffset === 4 && memberIndex === 3)
      ? [
          {
            description: 'Waiting for an external dependency to be resolved.',
            isKey: true,
            isResolved: false,
          },
        ]
      : [];
  return {
    weekStart: isoDate(weekStart),
    weekEnd: isoDate(weekEnd),
    project: { id: project.id, name: project.name },
    tasks: [
      {
        name: `Deliver ${label}`,
        priority: memberIndex % 2 === 0 ? Priority.HIGH : Priority.MEDIUM,
        plannedPercent: 100,
        actualPercent: versionNumber === 1 && weekOffset === 1 ? 75 : 100,
        status:
          versionNumber === 1 && weekOffset === 1
            ? TaskStatus.IN_PROGRESS
            : TaskStatus.COMPLETED,
        plannedHours: 8,
        spentHours: 7.5,
        output: `Completed iteration ${versionNumber}`,
      },
      {
        name: `Review ${project.name} changes`,
        priority: Priority.MEDIUM,
        plannedPercent: 100,
        actualPercent: 100,
        status: TaskStatus.COMPLETED,
        plannedHours: 2,
        spentHours: 2.25,
        output: 'Reviewed and documented changes',
      },
    ],
    nextWeekTasks: [
      {
        description: `Continue ${project.name} improvements`,
        priority: Priority.MEDIUM,
        estimatedHours: 4,
      },
    ],
    blockers,
    achievements: [
      {
        description: `Delivered a measurable improvement for ${project.name}.`,
        isKey: true,
      },
    ],
    timeEntries: [
      { taskType: TaskType.DEVELOPMENT, hours: 22 },
      { taskType: TaskType.TESTING, hours: 6 },
      { taskType: TaskType.MEETINGS, hours: 3 },
    ],
    notes: `Weekly update for ${project.name}.`,
    links: [],
  };
}

function submissionTime(
  weekStart: DateTime,
  weekOffset: number,
  versionNumber: number,
  versionsInReport: number,
  dueOffsetDays: number,
  isLate: boolean,
  now: DateTime,
): Date {
  if (weekOffset === 0) {
    return now.minus({ hours: 3 - versionNumber }).toJSDate();
  }
  const deadline = weekStart.plus({ days: dueOffsetDays });
  let firstSubmission = isLate
    ? deadline.plus({ days: 1, hours: 2 })
    : DateTime.max(weekStart, deadline.minus({ hours: 3 }));
  const lastReview = firstSubmission.plus({
    days: (versionsInReport - 1) * 2,
    hours: 1,
  });
  if (lastReview >= now) {
    firstSubmission = DateTime.max(
      weekStart,
      now.minus({ days: (versionsInReport - 1) * 2, hours: 2 }),
    );
  }
  const timestamp =
    versionNumber === 1
      ? firstSubmission
      : firstSubmission.plus({ days: (versionNumber - 1) * 2 });
  return timestamp.toJSDate();
}

export function buildDemoReportFixtures(options: {
  now: DateTime;
  timezone: string;
  dueOffsetDays: number;
}): DemoReportFixture[] {
  const now = options.now.setZone(options.timezone);
  if (!now.isValid) throw new Error('REPORT_TIMEZONE must be a valid timezone');
  if (!Number.isInteger(options.dueOffsetDays) || options.dueOffsetDays < 0) {
    throw new Error('REPORT_DUE_OFFSET_DAYS must be a non-negative integer');
  }
  const currentWeek = now.startOf('week').startOf('day');
  const managerId = DEMO_USERS[0].id;
  const fixtures: DemoReportFixture[] = [];

  for (let weekOffset = 0; weekOffset < 8; weekOffset += 1) {
    const weekStart = currentWeek.minus({ weeks: weekOffset });
    const weekEnd = weekStart.plus({ days: 6 });
    for (let memberIndex = 0; memberIndex < 5; memberIndex += 1) {
      if (weekOffset === 0 && memberIndex === 0) continue;

      const status = reportStatus(weekOffset, memberIndex);
      const count = versionCount(status, weekOffset, memberIndex);
      const project = DEMO_PROJECTS[(memberIndex + weekOffset) % 5];
      const deadline = weekStart.plus({ days: options.dueOffsetDays });
      const candidateLateSubmission = deadline.plus({ days: 1, hours: 2 });
      const latestCandidateReview = candidateLateSubmission.plus({
        days: (count - 1) * 2,
        hours: 1,
      });
      const isLate =
        weekOffset >= 2 &&
        ((weekOffset + memberIndex) % 4 === 0 || memberIndex === 4) &&
        latestCandidateReview < now;
      const versions: DemoVersionFixture[] = [];

      for (let versionNumber = 1; versionNumber <= count; versionNumber += 1) {
        const submittedAt = submissionTime(
          weekStart,
          weekOffset,
          versionNumber,
          count,
          options.dueOffsetDays,
          isLate,
          now,
        );
        const isCurrent = versionNumber === count;
        const needsReview = !(
          isCurrent &&
          (status === ReportStatus.SUBMITTED || status === ReportStatus.DRAFT)
        );
        const action =
          isCurrent && status === ReportStatus.APPROVED
            ? ReviewAction.APPROVED
            : ReviewAction.CHANGES_REQUESTED;
        const reviewedAt = new Date(submittedAt.getTime() + 60 * 60 * 1000);
        versions.push({
          versionNumber,
          submittedAt,
          snapshot: contentFor(
            weekStart,
            weekEnd,
            project,
            memberIndex,
            weekOffset,
            versionNumber,
          ),
          review: needsReview
            ? {
                action,
                comment:
                  action === ReviewAction.CHANGES_REQUESTED
                    ? `Please clarify the outcome for ${project.name}.`
                    : null,
                createdAt: reviewedAt,
                reviewerId: managerId,
              }
            : null,
        });
      }

      const currentVersion = versions.at(-1);
      const reviewedAt =
        currentVersion?.review && status !== ReportStatus.SUBMITTED
          ? currentVersion.review.createdAt
          : null;
      const workingContent =
        currentVersion?.snapshot ??
        contentFor(weekStart, weekEnd, project, memberIndex, weekOffset, 0);
      const content =
        status === ReportStatus.NEEDS_CORRECTION
          ? {
              ...workingContent,
              notes: `${workingContent.notes} Updated working copy awaiting resubmission.`,
            }
          : workingContent;

      fixtures.push({
        userId: DEMO_USERS[memberIndex + 1].id,
        projectId: project.id,
        weekStart: utcDatabaseDate(weekStart),
        weekEnd: utcDatabaseDate(weekEnd),
        status,
        currentVersion: count,
        submittedAt: currentVersion?.submittedAt ?? null,
        firstSubmittedAt: versions[0]?.submittedAt ?? null,
        reviewedAt,
        createdAt: utcDatabaseDate(weekStart),
        updatedAt: now.toJSDate(),
        content,
        versions,
      });
    }
  }

  return fixtures;
}
