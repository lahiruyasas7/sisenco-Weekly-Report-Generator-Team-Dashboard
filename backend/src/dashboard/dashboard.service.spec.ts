import { BadRequestException } from '@nestjs/common';
import { ReportStatus, Role } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DashboardService } from './dashboard.service.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function createHarness() {
  const user = { count: vi.fn() };
  const report = { findMany: vi.fn() };
  const blocker = { count: vi.fn() };
  const prisma = { user, report, blocker } as unknown as PrismaService;
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
});
