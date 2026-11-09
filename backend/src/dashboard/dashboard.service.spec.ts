import { BadRequestException } from '@nestjs/common';
import { ReportStatus, Role } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DashboardService } from './dashboard.service.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function createHarness() {
  const user = { count: vi.fn(), findMany: vi.fn() };
  const report = { findMany: vi.fn() };
  const blocker = { count: vi.fn() };
  const timeEntry = { groupBy: vi.fn() };
  const reportVersion = { findMany: vi.fn() };
  const review = { findMany: vi.fn() };
  const $queryRaw = vi.fn();
  const prisma = {
    user,
    report,
    blocker,
    timeEntry,
    reportVersion,
    review,
    $queryRaw,
  } as unknown as PrismaService;
  const config = {
    get: vi.fn((key: string) =>
      key === 'REPORT_TIMEZONE' ? 'Asia/Colombo' : 7,
    ),
  };

  return {
    service: new DashboardService(prisma, config as never),
    user,
    report,
    blocker,
    timeEntry,
    reportVersion,
    review,
    $queryRaw,
  };
}

function makeReport(
  status: ReportStatus,
  firstSubmittedAt: Date | null,
  user: {
    role: Role;
    isActive: boolean;
    createdAt: Date;
  },
) {
  return { status, firstSubmittedAt, user };
}

describe('DashboardService summary', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-09T12:00:00+05:30'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('counts reports by selected report week and buckets eligible members', async () => {
    const { service, user, report, blocker } = createHarness();
    const eligibleMember = {
      role: Role.MEMBER,
      isActive: true,
      createdAt: new Date('2026-10-01T00:00:00+05:30'),
    };
    vi.mocked(user.count).mockResolvedValue(5);
    vi.mocked(report.findMany).mockResolvedValue([
      makeReport(
        ReportStatus.APPROVED,
        new Date('2026-10-27T12:00:00+05:30'),
        eligibleMember,
      ),
      makeReport(
        ReportStatus.SUBMITTED,
        new Date('2026-11-03T12:00:00+05:30'),
        eligibleMember,
      ),
      makeReport(ReportStatus.DRAFT, null, eligibleMember),
      makeReport(
        ReportStatus.NEEDS_CORRECTION,
        new Date('2026-10-30T12:00:00+05:30'),
        eligibleMember,
      ),
      makeReport(ReportStatus.APPROVED, new Date(), {
        ...eligibleMember,
        isActive: false,
      }),
      makeReport(ReportStatus.SUBMITTED, new Date(), {
        ...eligibleMember,
        createdAt: new Date('2026-11-02T00:00:00+05:30'),
      }),
    ] as never);
    vi.mocked(blocker.count).mockResolvedValue(2);

    await expect(service.summary('2026-10-26')).resolves.toEqual({
      weekStart: '2026-10-26',
      weekEnd: '2026-11-01',
      totalSubmitted: 5,
      compliance: { onTime: 2, late: 3, pending: 0, eligible: 5 },
      needsCorrection: 1,
      openBlockers: 2,
    });
    expect(report.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { weekStart: expect.any(Date) },
      }),
    );
    expect(blocker.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isResolved: false,
          report: {
            weekStart: expect.any(Date),
            status: { in: [ReportStatus.SUBMITTED, ReportStatus.APPROVED] },
          },
        },
      }),
    );
  });

  it('counts eligible members without submissions as pending before the deadline', async () => {
    vi.setSystemTime(new Date('2026-11-01T10:00:00Z'));
    const { service, user, report, blocker } = createHarness();
    vi.mocked(user.count).mockResolvedValue(3);
    vi.mocked(report.findMany).mockResolvedValue([
      makeReport(ReportStatus.SUBMITTED, new Date('2026-10-27T12:00:00Z'), {
        role: Role.MEMBER,
        isActive: true,
        createdAt: new Date('2026-10-01T00:00:00Z'),
      }),
    ] as never);
    vi.mocked(blocker.count).mockResolvedValue(0);

    await expect(service.summary('2026-10-26')).resolves.toMatchObject({
      totalSubmitted: 1,
      compliance: { onTime: 1, late: 0, pending: 2, eligible: 3 },
    });
  });

  it('rejects non-Monday weeks without querying the database', async () => {
    const { service, user, report, blocker } = createHarness();

    await expect(service.summary('2026-10-27')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(user.count).not.toHaveBeenCalled();
    expect(report.findMany).not.toHaveBeenCalled();
    expect(blocker.count).not.toHaveBeenCalled();
  });

  it('returns completed tasks for every week, including weeks with no matches', async () => {
    const { service, $queryRaw } = createHarness();
    vi.mocked($queryRaw).mockResolvedValue([
      { weekStart: '2026-10-19', completedTasks: 3 },
      { weekStart: '2026-10-26', completedTasks: 0 },
      { weekStart: '2026-11-02', completedTasks: 5 },
    ]);

    await expect(
      service.tasksTrend('2026-10-19', '2026-11-02'),
    ).resolves.toEqual({
      from: '2026-10-19',
      to: '2026-11-02',
      data: [
        { weekStart: '2026-10-19', completedTasks: 3 },
        { weekStart: '2026-10-26', completedTasks: 0 },
        { weekStart: '2026-11-02', completedTasks: 5 },
      ],
    });
    expect($queryRaw).toHaveBeenCalledOnce();
  });

  it('accepts an optional member filter and rejects invalid week ranges', async () => {
    const { service, $queryRaw } = createHarness();
    vi.mocked($queryRaw).mockResolvedValue([]);

    await expect(
      service.tasksTrend(
        '2026-10-19',
        '2026-10-26',
        '2f1e7a5e-b826-4daf-9a7e-6a2181fc778a',
      ),
    ).resolves.toMatchObject({ data: [] });
    expect($queryRaw).toHaveBeenCalledOnce();

    await expect(
      service.tasksTrend('2026-10-20', '2026-10-26'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.tasksTrend('2026-10-26', '2026-10-19'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect($queryRaw).toHaveBeenCalledOnce();
  });

  it('returns statuses for eligible members without exposing draft report content', async () => {
    const { service, user } = createHarness();
    vi.mocked(user.findMany).mockResolvedValue([
      {
        id: 'member-1',
        name: 'Alice',
        reports: [{ status: ReportStatus.DRAFT }],
      },
      {
        id: 'member-2',
        name: 'Bob',
        reports: [{ status: ReportStatus.APPROVED }],
      },
      { id: 'member-3', name: 'Casey', reports: [] },
    ] as never);

    await expect(service.statusByMember('2026-10-19')).resolves.toEqual({
      weekStart: '2026-10-19',
      weekEnd: '2026-10-25',
      data: [
        { user: { id: 'member-1', name: 'Alice' }, status: 'DRAFT' },
        { user: { id: 'member-2', name: 'Bob' }, status: 'APPROVED' },
        { user: { id: 'member-3', name: 'Casey' }, status: 'NOT_STARTED' },
      ],
    });
    expect(user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          role: Role.MEMBER,
          isActive: true,
        }),
        select: expect.objectContaining({
          reports: {
            where: { weekStart: expect.any(Date) },
            select: { status: true },
          },
        }),
      }),
    );
  });

  it('aggregates workload by project for submitted and approved reports', async () => {
    const { service, $queryRaw } = createHarness();
    vi.mocked($queryRaw).mockResolvedValue([
      {
        projectId: 'project-1',
        projectName: 'Client A',
        taskCount: 4,
        spentHours: 19.5,
      },
    ]);

    await expect(
      service.workloadByProject('2026-10-19', '2026-11-02'),
    ).resolves.toEqual({
      from: '2026-10-19',
      to: '2026-11-02',
      data: [
        {
          projectId: 'project-1',
          projectName: 'Client A',
          taskCount: 4,
          spentHours: 19.5,
        },
      ],
    });
    expect($queryRaw).toHaveBeenCalledOnce();
    await expect(
      service.workloadByProject('2026-10-20', '2026-11-02'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect($queryRaw).toHaveBeenCalledOnce();
  });

  it('returns time totals for every task type, including types with no hours', async () => {
    const { service, timeEntry } = createHarness();
    vi.mocked(timeEntry.groupBy).mockResolvedValue([
      { taskType: 'DEVELOPMENT', _sum: { hours: 10.126 } },
      { taskType: 'MEETINGS', _sum: { hours: 2.5 } },
    ] as never);

    await expect(
      service.timeByType('2026-10-19', '2026-10-26'),
    ).resolves.toMatchObject({
      from: '2026-10-19',
      to: '2026-10-26',
      data: expect.arrayContaining([
        { taskType: 'DEVELOPMENT', hours: 10.13 },
        { taskType: 'MEETINGS', hours: 2.5 },
        { taskType: 'TESTING', hours: 0 },
      ]),
    });
    expect(timeEntry.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['taskType'],
        where: {
          report: {
            weekStart: { gte: expect.any(Date), lte: expect.any(Date) },
            status: { in: [ReportStatus.SUBMITTED, ReportStatus.APPROVED] },
          },
        },
      }),
    );
  });

  it('merges submissions and reviews by newest timestamp and limits activity results', async () => {
    const { service, reportVersion, review } = createHarness();
    const report = {
      id: 'report-1',
      weekStart: new Date('2026-10-19T00:00:00.000Z'),
      user: { id: 'member-1', name: 'Alice' },
    };
    vi.mocked(reportVersion.findMany).mockResolvedValue([
      {
        id: 'version-1',
        versionNumber: 1,
        submittedAt: new Date('2026-10-20T10:00:00.000Z'),
        report,
        submittedBy: { id: 'member-1', name: 'Alice' },
      },
    ] as never);
    vi.mocked(review.findMany).mockResolvedValue([
      {
        id: 'review-1',
        action: 'CHANGES_REQUESTED',
        comment: 'Please add details.',
        createdAt: new Date('2026-10-21T10:00:00.000Z'),
        report,
        reviewer: { id: 'manager-1', name: 'Morgan' },
      },
      {
        id: 'review-2',
        action: 'APPROVED',
        comment: null,
        createdAt: new Date('2026-10-19T10:00:00.000Z'),
        report,
        reviewer: { id: 'manager-1', name: 'Morgan' },
      },
    ] as never);

    await expect(service.activity(2)).resolves.toEqual({
      data: [
        expect.objectContaining({
          id: 'review-1',
          type: 'REVIEW',
          action: 'CHANGES_REQUESTED',
          weekStart: '2026-10-19',
        }),
        expect.objectContaining({
          id: 'version-1',
          type: 'SUBMISSION',
          versionNumber: 1,
          weekStart: '2026-10-19',
        }),
      ],
    });
    expect(reportVersion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 2 }),
    );
    expect(review.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 2 }),
    );
  });
});
