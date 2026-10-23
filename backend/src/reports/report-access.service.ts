import { Injectable, NotFoundException } from '@nestjs/common';
import { ReportStatus, Role, type Prisma } from '../generated/prisma/client.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  reportContentInclude,
  ReportSnapshotService,
} from './report-snapshot.service.js';

const reportViewerInclude = {
  ...reportContentInclude,
  user: { select: { id: true, name: true } },
  reviews: {
    orderBy: { createdAt: 'desc' },
    take: 1,
    include: { reviewer: { select: { id: true, name: true } } },
  },
} satisfies Prisma.ReportInclude;

@Injectable()
export class ReportAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly snapshots: ReportSnapshotService,
  ) {}

  async assertCanWrite(reportId: string, user: AuthenticatedUser) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      select: { id: true, userId: true, status: true },
    });
    if (!report || user.role !== Role.MEMBER || report.userId !== user.id) {
      throw new NotFoundException('Report not found');
    }
    return report;
  }

  async assertCanRead(reportId: string, user: AuthenticatedUser) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      select: { id: true, userId: true, status: true },
    });
    if (!report) throw new NotFoundException('Report not found');

    if (user.role === Role.MEMBER && report.userId === user.id) return report;
    if (
      (user.role === Role.MANAGER || user.role === Role.ADMIN) &&
      report.status !== ReportStatus.DRAFT
    ) {
      return report;
    }
    throw new NotFoundException('Report not found');
  }

  async loadForViewer(reportId: string, user: AuthenticatedUser) {
    const report = await this.assertCanRead(reportId, user);
    const loaded = await this.prisma.report.findUnique({
      where: { id: report.id },
      include: reportViewerInclude,
    });
    if (!loaded) throw new NotFoundException('Report not found');

    const isOwner = user.role === Role.MEMBER && loaded.userId === user.id;
    const latestReview = loaded.reviews[0];
    let content = this.snapshots.toContent(loaded);

    if (!isOwner) {
      const version = await this.prisma.reportVersion.findUnique({
        where: {
          reportId_versionNumber: {
            reportId: loaded.id,
            versionNumber: loaded.currentVersion,
          },
        },
        select: { snapshot: true },
      });
      if (!version) throw new NotFoundException('Report not found');
      content = version.snapshot as typeof content;
    }

    return {
      id: loaded.id,
      user: loaded.user,
      status: loaded.status,
      currentVersion: loaded.currentVersion,
      submittedAt: loaded.submittedAt,
      firstSubmittedAt: loaded.firstSubmittedAt,
      reviewedAt: loaded.reviewedAt,
      latestReview: latestReview
        ? {
            action: latestReview.action,
            comment: latestReview.comment,
            createdAt: latestReview.createdAt,
            reviewer: latestReview.reviewer,
          }
        : null,
      content,
    };
  }
}
