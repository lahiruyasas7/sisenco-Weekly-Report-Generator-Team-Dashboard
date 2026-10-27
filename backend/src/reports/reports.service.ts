import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, ReportStatus } from '../generated/prisma/client.js';
import type { Env } from '../config/env.validation.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.js';
import {
  dateOnlyToDatabase,
  databaseDateToOnly,
  parseReportDate,
  assertMonday,
  currentWeekStart,
  reportWeekEnd,
} from '../common/utils/week.util.js';
import type { CreateReportDto } from './dto/create-report.dto.js';
import type { ListMyReportsDto } from './dto/list-my-reports.dto.js';
import type { ListReportsDto } from './dto/list-reports.dto.js';
import { ReportAccessService } from './report-access.service.js';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    private readonly access: ReportAccessService,
  ) {}

  async create(user: AuthenticatedUser, input: CreateReportDto) {
    const timezone = this.config.get('REPORT_TIMEZONE', { infer: true });
    const weekStart = parseReportDate(input.weekStart, timezone);
    assertMonday(weekStart);
    if (weekStart > currentWeekStart(timezone)) {
      throw new BadRequestException(
        'Reports cannot be created for a future week',
      );
    }

    const dateStart = dateOnlyToDatabase(weekStart);
    const dateEnd = dateOnlyToDatabase(reportWeekEnd(weekStart));
    const created = await this.prisma.$transaction(async (transaction) => {
      if (input.projectId) {
        const project = await transaction.project.findUnique({
          where: { id: input.projectId },
          select: { id: true, isArchived: true },
        });
        if (!project) throw new NotFoundException('Project not found');
        if (project.isArchived) {
          throw new BadRequestException('Archived projects cannot be selected');
        }
      }

      return transaction.report.create({
        data: {
          userId: user.id,
          weekStart: dateStart,
          weekEnd: dateEnd,
          ...(input.projectId ? { projectId: input.projectId } : {}),
          links: [],
        },
        select: {
          id: true,
          userId: true,
          weekStart: true,
          weekEnd: true,
          status: true,
          currentVersion: true,
          createdAt: true,
        },
      });
    });
    return this.access.loadForViewer(created.id, user);
  }

  async listMine(user: AuthenticatedUser, input: ListMyReportsDto) {
    const timezone = this.config.get('REPORT_TIMEZONE', { infer: true });
    const from = input.from ? parseReportDate(input.from, timezone) : undefined;
    const to = input.to ? parseReportDate(input.to, timezone) : undefined;
    if (from && to && from > to) {
      throw new BadRequestException('from must be on or before to');
    }

    const where: Prisma.ReportWhereInput = {
      userId: user.id,
      ...(input.status ? { status: input.status } : {}),
      ...(from || to
        ? {
            weekStart: {
              ...(from ? { gte: dateOnlyToDatabase(from) } : {}),
              ...(to ? { lte: dateOnlyToDatabase(to) } : {}),
            },
          }
        : {}),
    };
    const skip = (input.page - 1) * input.limit;
    const [reports, total] = await this.prisma.$transaction([
      this.prisma.report.findMany({
        where,
        select: {
          id: true,
          weekStart: true,
          weekEnd: true,
          status: true,
          currentVersion: true,
          submittedAt: true,
          firstSubmittedAt: true,
          project: { select: { id: true, name: true } },
        },
        orderBy: [{ weekStart: 'desc' }, { id: 'asc' }],
        skip,
        take: input.limit,
      }),
      this.prisma.report.count({ where }),
    ]);

    return {
      data: reports.map((report) => ({
        ...report,
        weekStart: databaseDateToOnly(report.weekStart),
        weekEnd: databaseDateToOnly(report.weekEnd),
      })),
      meta: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: Math.ceil(total / input.limit),
      },
    };
  }

  getOne(reportId: string, user: AuthenticatedUser) {
    return this.access.loadForViewer(reportId, user);
  }

  async listForReview(input: ListReportsDto) {
    if (input.from && input.to && input.from > input.to) {
      throw new BadRequestException('from must be on or before to');
    }
    if (input.weekStart && (input.from || input.to)) {
      throw new BadRequestException(
        'Use weekStart or a from/to range, not both',
      );
    }

    const dateRange = input.weekStart
      ? { equals: dateOnlyToDatabase(parseReportDate(input.weekStart, 'UTC')) }
      : input.from || input.to
        ? {
            ...(input.from
              ? { gte: dateOnlyToDatabase(parseReportDate(input.from, 'UTC')) }
              : {}),
            ...(input.to
              ? { lte: dateOnlyToDatabase(parseReportDate(input.to, 'UTC')) }
              : {}),
          }
        : undefined;
    const where: Prisma.ReportWhereInput = {
      status: {
        not: ReportStatus.DRAFT,
        ...(input.status ? { equals: input.status } : {}),
      },
      ...(dateRange ? { weekStart: dateRange } : {}),
      ...(input.userId ? { userId: input.userId } : {}),
      ...(input.projectId ? { projectId: input.projectId } : {}),
    };
    const skip = (input.page - 1) * input.limit;
    const [reports, total] = await this.prisma.$transaction([
      this.prisma.report.findMany({
        where,
        select: {
          id: true,
          userId: true,
          user: { select: { id: true, name: true } },
          weekStart: true,
          weekEnd: true,
          status: true,
          currentVersion: true,
          submittedAt: true,
          project: { select: { id: true, name: true } },
        },
        orderBy: [
          { weekStart: 'desc' },
          { submittedAt: 'desc' },
          { id: 'asc' },
        ],
        skip,
        take: input.limit,
      }),
      this.prisma.report.count({ where }),
    ]);
    return {
      data: reports.map((report) => ({
        ...report,
        weekStart: databaseDateToOnly(report.weekStart),
        weekEnd: databaseDateToOnly(report.weekEnd),
      })),
      meta: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: Math.ceil(total / input.limit),
      },
    };
  }

  async listVersions(reportId: string, user: AuthenticatedUser) {
    const report = await this.access.assertCanRead(reportId, user);
    const versions = await this.prisma.reportVersion.findMany({
      where: { reportId: report.id },
      select: {
        versionNumber: true,
        submittedAt: true,
        reviews: {
          select: {
            action: true,
            comment: true,
            createdAt: true,
            reviewer: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { versionNumber: 'desc' },
    });
    return {
      data: versions.map(({ versionNumber, ...version }) => ({
        number: versionNumber,
        ...version,
      })),
    };
  }

  async getVersion(
    reportId: string,
    versionNumber: number,
    user: AuthenticatedUser,
  ) {
    const report = await this.access.assertCanRead(reportId, user);
    if (!Number.isInteger(versionNumber) || versionNumber < 1) {
      throw new NotFoundException('Report version not found');
    }
    const version = await this.prisma.reportVersion.findUnique({
      where: { reportId_versionNumber: { reportId: report.id, versionNumber } },
      select: {
        versionNumber: true,
        submittedAt: true,
        snapshot: true,
        reviews: {
          select: {
            action: true,
            comment: true,
            createdAt: true,
            reviewer: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!version) throw new NotFoundException('Report version not found');
    return {
      number: version.versionNumber,
      submittedAt: version.submittedAt,
      content: version.snapshot,
      reviews: version.reviews,
    };
  }

  async listReviews(reportId: string, user: AuthenticatedUser) {
    const report = await this.access.assertCanRead(reportId, user);
    const reviews = await this.prisma.review.findMany({
      where: { reportId: report.id },
      select: {
        action: true,
        comment: true,
        createdAt: true,
        reviewer: { select: { id: true, name: true } },
        version: { select: { versionNumber: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return {
      data: reviews.map(({ version, ...review }) => ({
        ...review,
        versionNumber: version.versionNumber,
      })),
    };
  }
}
