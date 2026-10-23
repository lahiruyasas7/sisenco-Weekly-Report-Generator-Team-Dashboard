import { NotFoundException } from '@nestjs/common';
import { ReportStatus, Role } from '../generated/prisma/client.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.js';
import { describe, expect, it, vi } from 'vitest';
import { ReportAccessService } from './report-access.service.js';

const viewer = (role: Role, id: string): AuthenticatedUser => ({
  id,
  email: `${id}@example.test`,
  name: id,
  role,
  isActive: true,
  mustChangePassword: false,
  sessionId: 'session-id',
});

describe('ReportAccessService', () => {
  it('hides another member’s report and manager-visible drafts with 404', async () => {
    const prisma = {
      report: { findUnique: vi.fn() },
    };
    const service = new ReportAccessService(
      prisma as never,
      { toContent: vi.fn() } as never,
    );

    prisma.report.findUnique.mockResolvedValue({
      id: 'report-id',
      userId: 'owner-id',
      status: ReportStatus.DRAFT,
    });
    await expect(
      service.assertCanRead('report-id', viewer(Role.MEMBER, 'other-id')),
    ).rejects.toThrow(NotFoundException);
    await expect(
      service.assertCanRead('report-id', viewer(Role.MANAGER, 'manager-id')),
    ).rejects.toThrow(NotFoundException);
  });

  it('allows a manager to read submitted reports', async () => {
    const prisma = {
      report: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'report-id',
          userId: 'owner-id',
          status: ReportStatus.SUBMITTED,
        }),
      },
    };
    const service = new ReportAccessService(
      prisma as never,
      { toContent: vi.fn() } as never,
    );

    await expect(
      service.assertCanRead('report-id', viewer(Role.ADMIN, 'admin-id')),
    ).resolves.toMatchObject({ status: ReportStatus.SUBMITTED });
  });

  it('serves the owner’s working content and a non-owner’s version snapshot', async () => {
    const loadedReport = {
      id: 'report-id',
      userId: 'owner-id',
      status: ReportStatus.NEEDS_CORRECTION,
      currentVersion: 2,
      submittedAt: new Date('2026-10-20T12:00:00Z'),
      firstSubmittedAt: new Date('2026-10-20T12:00:00Z'),
      reviewedAt: new Date('2026-10-21T12:00:00Z'),
      user: { id: 'owner-id', name: 'Owner' },
      reviews: [],
      project: null,
    };
    const prisma = {
      report: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({
            id: 'report-id',
            userId: 'owner-id',
            status: ReportStatus.NEEDS_CORRECTION,
          })
          .mockResolvedValueOnce(loadedReport),
      },
      reportVersion: {
        findUnique: vi.fn().mockResolvedValue({
          snapshot: { weekStart: '2026-10-19', notes: 'submitted snapshot' },
        }),
      },
    };
    const snapshots = {
      toContent: vi.fn().mockReturnValue({
        weekStart: '2026-10-19',
        notes: 'working copy',
      }),
    };
    const service = new ReportAccessService(
      prisma as never,
      snapshots as never,
    );

    const ownerResult = await service.loadForViewer(
      'report-id',
      viewer(Role.MEMBER, 'owner-id'),
    );
    expect(ownerResult.content).toMatchObject({ notes: 'working copy' });
    expect(prisma.reportVersion.findUnique).not.toHaveBeenCalled();

    prisma.report.findUnique
      .mockReset()
      .mockResolvedValueOnce({
        id: 'report-id',
        userId: 'owner-id',
        status: ReportStatus.NEEDS_CORRECTION,
      })
      .mockResolvedValueOnce(loadedReport);
    const managerResult = await service.loadForViewer(
      'report-id',
      viewer(Role.MANAGER, 'manager-id'),
    );
    expect(managerResult.content).toMatchObject({
      notes: 'submitted snapshot',
    });
    expect(prisma.reportVersion.findUnique).toHaveBeenCalledWith({
      where: {
        reportId_versionNumber: { reportId: 'report-id', versionNumber: 2 },
      },
      select: { snapshot: true },
    });
  });
});
