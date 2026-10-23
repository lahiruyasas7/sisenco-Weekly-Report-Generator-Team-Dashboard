import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../generated/prisma/client.js';
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
}
