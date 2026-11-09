import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ReportStatus, Role } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TeamService } from './team.service.js';
import { describe, expect, it, vi } from 'vitest';

function createHarness() {
  const user = { findMany: vi.fn() };
  const report = { findMany: vi.fn() };
  const reportVersion = { findMany: vi.fn() };
  const prisma = {
    user,
    report,
    reportVersion,
  } as unknown as PrismaService;
  const config = {
    get: vi.fn(() => 'Asia/Colombo'),
  };

  return {
    service: new TeamService(prisma, config as never),
    user,
    report,
    reportVersion,
  };
}

describe('TeamService', () => {
  it('returns eligible member statuses without exposing draft report IDs', async () => {
    const { service, user, report } = createHarness();
    const members = [
      { id: 'member-1', name: 'Alice' },
      { id: 'member-2', name: 'Bob' },
      { id: 'member-3', name: 'Casey' },
    ];
    vi.mocked(user.findMany).mockResolvedValue(members as never);
    vi.mocked(report.findMany).mockResolvedValue([
      {
        id: 'draft-id',
        userId: 'member-1',
        status: ReportStatus.DRAFT,
      },
      {
        id: 'submitted-id',
        userId: 'member-2',
        status: ReportStatus.SUBMITTED,
      },
    ] as never);

    await expect(service.weekStatus('2026-11-02')).resolves.toEqual({
      weekStart: '2026-11-02',
      weekEnd: '2026-11-08',
      data: [
        { user: members[0], status: ReportStatus.DRAFT },
        {
          user: members[1],
          status: ReportStatus.SUBMITTED,
          reportId: 'submitted-id',
        },
        { user: members[2], status: 'NOT_STARTED', reportId: null },
      ],
    });
    expect(user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          role: Role.MEMBER,
          isActive: true,
          createdAt: { lt: expect.any(Date) },
        },
        select: { id: true, name: true },
      }),
    );
    expect(report.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: { in: ['member-1', 'member-2', 'member-3'] },
          weekStart: expect.any(Date),
        },
        select: { id: true, userId: true, status: true },
      }),
    );
  });

  it('does not query reports when there are no eligible members', async () => {
    const { service, user, report } = createHarness();
    vi.mocked(user.findMany).mockResolvedValue([]);

    await expect(service.weekStatus('2026-11-02')).resolves.toMatchObject({
      data: [],
    });
    expect(report.findMany).not.toHaveBeenCalled();
  });

  it('rejects week starts that are not Mondays', async () => {
    const { service, user } = createHarness();

    await expect(service.weekStatus('2026-11-03')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(user.findMany).not.toHaveBeenCalled();
  });

  it('returns section data from current-version snapshots only', async () => {
    const { service, report, reportVersion } = createHarness();
    const reportId = 'report-1';
    const snapshot = {
      blockers: [
        { description: 'Snapshot blocker', isKey: true, isResolved: false },
      ],
      achievements: [],
      nextWeekTasks: [{ description: 'Plan from snapshot' }],
      notes: 'Snapshot notes',
    };
    vi.mocked(report.findMany).mockResolvedValue([
      {
        id: reportId,
        userId: 'member-1',
        currentVersion: 2,
        user: { id: 'member-1', name: 'Alice' },
      },
    ] as never);
    vi.mocked(reportVersion.findMany).mockResolvedValue([
      { reportId, versionNumber: 2, snapshot },
    ] as never);

    await expect(service.sections('2026-11-02', 'nextWeek')).resolves.toEqual({
      weekStart: '2026-11-02',
      weekEnd: '2026-11-08',
      section: 'nextWeek',
      data: [
        {
          user: { id: 'member-1', name: 'Alice' },
          reportId,
          content: snapshot.nextWeekTasks,
        },
      ],
    });
    expect(report.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          weekStart: expect.any(Date),
          status: { in: [ReportStatus.SUBMITTED, ReportStatus.APPROVED] },
          user: {
            role: Role.MEMBER,
            isActive: true,
            createdAt: { lt: expect.any(Date) },
          },
        },
      }),
    );
    expect(reportVersion.findMany).toHaveBeenCalledWith({
      where: {
        reportId: { in: [reportId] },
        versionNumber: { in: [2] },
      },
      select: { reportId: true, versionNumber: true, snapshot: true },
    });
  });

  it('returns an empty section list when no submitted reports exist', async () => {
    const { service, report, reportVersion } = createHarness();
    vi.mocked(report.findMany).mockResolvedValue([]);

    await expect(
      service.sections('2026-11-02', 'blockers'),
    ).resolves.toMatchObject({
      section: 'blockers',
      data: [],
    });
    expect(reportVersion.findMany).not.toHaveBeenCalled();
  });

  it('fails explicitly when a report has no current version snapshot', async () => {
    const { service, report, reportVersion } = createHarness();
    vi.mocked(report.findMany).mockResolvedValue([
      {
        id: 'report-1',
        userId: 'member-1',
        currentVersion: 1,
        user: { id: 'member-1', name: 'Alice' },
      },
    ] as never);
    vi.mocked(reportVersion.findMany).mockResolvedValue([]);

    await expect(
      service.sections('2026-11-02', 'notes'),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });
});
