import { BadRequestException, ConflictException } from '@nestjs/common';
import { ReportStatus, Role } from '../generated/prisma/client.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.js';
import { describe, expect, it, vi } from 'vitest';
import { ReportWorkflowService } from './report-workflow.service.js';

const member: AuthenticatedUser = {
  id: 'member-id',
  email: 'member@example.test',
  name: 'Member',
  role: Role.MEMBER,
  isActive: true,
  mustChangePassword: false,
  sessionId: 'session-id',
};

function setup(
  status: (typeof ReportStatus)[keyof typeof ReportStatus] = ReportStatus.DRAFT,
  project = true,
) {
  const record = {
    id: 'report-id',
    userId: member.id,
    projectId: project ? 'project-id' : null,
    weekStart: new Date('2026-10-19T00:00:00.000Z'),
    weekEnd: new Date('2026-10-25T00:00:00.000Z'),
    status,
    currentVersion: 0,
    notes: null,
    links: [],
    submittedAt: null,
    firstSubmittedAt: null,
    reviewedAt: null,
    createdAt: new Date('2026-10-20T00:00:00.000Z'),
    updatedAt: new Date('2026-10-20T00:00:00.000Z'),
    project: project
      ? { id: 'project-id', name: 'Client A', isArchived: false }
      : null,
    tasks: [
      {
        id: 'task-id',
        reportId: 'report-id',
        position: 0,
        name: 'Build feature',
        priority: 'MEDIUM',
        plannedPercent: 100,
        actualPercent: 100,
        status: 'COMPLETED',
        plannedHours: 4,
        spentHours: 4,
        output: null,
      },
    ],
    nextWeekTasks: [],
    blockers: [],
    achievements: [],
    timeEntries: [],
  };
  const transaction = {
    report: {
      findUnique: vi.fn().mockResolvedValue(record),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    reportVersion: { create: vi.fn().mockResolvedValue({ id: 'version-id' }) },
  };
  const prisma = {
    $transaction: vi.fn(async (callback: (tx: typeof transaction) => unknown) =>
      callback(transaction),
    ),
  };
  const access = {
    assertCanWrite: vi.fn().mockResolvedValue({ id: record.id, status }),
    loadForViewer: vi.fn().mockResolvedValue({ id: record.id }),
  };
  const snapshots = {
    toSnapshot: vi.fn().mockReturnValue({ weekStart: '2026-10-19' }),
  };
  const service = new ReportWorkflowService(
    prisma as never,
    access as never,
    snapshots as never,
  );
  return { service, transaction, access, snapshots, record };
}

describe('ReportWorkflowService submission', () => {
  it('writes a version snapshot and transitions the expected draft to submitted', async () => {
    const { service, transaction, snapshots } = setup();

    await service.submit('report-id', member);

    expect(transaction.report.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'report-id', status: ReportStatus.DRAFT },
        data: expect.objectContaining({
          status: ReportStatus.SUBMITTED,
          currentVersion: { increment: 1 },
        }),
      }),
    );
    expect(snapshots.toSnapshot).toHaveBeenCalled();
    expect(transaction.reportVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reportId: 'report-id',
          versionNumber: 1,
          submittedById: member.id,
        }),
      }),
    );
  });

  it('requires a selected project and at least one named task', async () => {
    const missingProject = setup(ReportStatus.DRAFT, false);
    await expect(
      missingProject.service.submit('report-id', member),
    ).rejects.toThrow(BadRequestException);
    expect(missingProject.transaction.report.updateMany).not.toHaveBeenCalled();

    const missingTask = setup();
    missingTask.record.tasks[0].name = '   ';
    await expect(
      missingTask.service.submit('report-id', member),
    ).rejects.toThrow(BadRequestException);
    expect(missingTask.transaction.report.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a submission from a locked status with a conflict', async () => {
    const { service, transaction } = setup(ReportStatus.APPROVED);
    await expect(service.submit('report-id', member)).rejects.toThrow(
      ConflictException,
    );
    expect(transaction.report.findUnique).not.toHaveBeenCalled();
  });
});
