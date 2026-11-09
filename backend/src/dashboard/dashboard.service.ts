import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DateTime } from 'luxon';
import { Prisma } from '../generated/prisma/client.js';
import { ReportStatus, Role, TaskType } from '../generated/prisma/client.js';
import {
  assertMonday,
  dateOnlyToDatabase,
  databaseDateToOnly,
  parseReportDate,
  reportWeekEnd,
  submissionDeadline,
} from '../common/utils/week.util.js';
import type { Env } from '../config/env.validation.js';
import { PrismaService } from '../prisma/prisma.service.js';

const CONTENT_STATUSES = [ReportStatus.SUBMITTED, ReportStatus.APPROVED];

type CompletedTaskTrendRow = {
  weekStart: string;
  completedTasks: number;
};

type ProjectWorkloadRow = {
  projectId: string;
  projectName: string;
  taskCount: number;
  spentHours: number;
};

type Activity =
  | {
      id: string;
      type: 'SUBMISSION';
      timestamp: Date;
      reportId: string;
      weekStart: string;
      versionNumber: number;
      member: { id: string; name: string };
      submittedBy: { id: string; name: string };
    }
  | {
      id: string;
      type: 'REVIEW';
      timestamp: Date;
      reportId: string;
      weekStart: string;
      action: 'APPROVED' | 'CHANGES_REQUESTED';
      comment: string | null;
      member: { id: string; name: string };
      reviewer: { id: string; name: string };
    };

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async summary(weekStartInput: string) {
    const timezone = this.config.get('REPORT_TIMEZONE', { infer: true });
    const dueOffsetDays = this.config.get('REPORT_DUE_OFFSET_DAYS', {
      infer: true,
    });
    const weekStart = parseReportDate(weekStartInput, timezone);
    assertMonday(weekStart);

    const weekEnd = reportWeekEnd(weekStart);
    const weekEndExclusive = weekEnd
      .plus({ days: 1 })
      .startOf('day')
      .toJSDate();
    const weekStartDate = dateOnlyToDatabase(weekStart);
    const deadline = submissionDeadline(weekStart, timezone, dueOffsetDays);

    const [eligible, reports, openBlockers] = await Promise.all([
      this.prisma.user.count({
        where: {
          role: Role.MEMBER,
          isActive: true,
          createdAt: { lt: weekEndExclusive },
        },
      }),
      this.prisma.report.findMany({
        where: { weekStart: weekStartDate },
        select: {
          status: true,
          firstSubmittedAt: true,
          user: {
            select: { role: true, isActive: true, createdAt: true },
          },
        },
      }),
      this.prisma.blocker.count({
        where: {
          isResolved: false,
          report: {
            weekStart: weekStartDate,
            status: { in: CONTENT_STATUSES },
          },
        },
      }),
    ]);

    const totalSubmitted = reports.filter(
      (report) => report.firstSubmittedAt !== null,
    ).length;
    const needsCorrection = reports.filter(
      (report) => report.status === ReportStatus.NEEDS_CORRECTION,
    ).length;
    const eligibleReports = reports.filter(
      (report) =>
        report.user.role === Role.MEMBER &&
        report.user.isActive &&
        report.user.createdAt < weekEndExclusive,
    );
    const submittedEligibleReports = eligibleReports
      .map((report) => report.firstSubmittedAt)
      .filter((submittedAt): submittedAt is Date => submittedAt !== null);
    const onTime = submittedEligibleReports.filter(
      (submittedAt) => submittedAt.getTime() <= deadline.toMillis(),
    ).length;
    const lateSubmissions = submittedEligibleReports.filter(
      (submittedAt) => submittedAt.getTime() > deadline.toMillis(),
    ).length;
    const unsubmitted = eligible - submittedEligibleReports.length;
    const deadlinePassed = DateTime.now().toMillis() > deadline.toMillis();

    return {
      weekStart: weekStart.toFormat('yyyy-MM-dd'),
      weekEnd: weekEnd.toFormat('yyyy-MM-dd'),
      totalSubmitted,
      compliance: {
        onTime,
        late: lateSubmissions + (deadlinePassed ? unsubmitted : 0),
        pending: deadlinePassed ? 0 : unsubmitted,
        eligible,
      },
      needsCorrection,
      openBlockers,
    };
  }

  async tasksTrend(fromInput: string, toInput: string, userId?: string) {
    const { from, to } = this.parseWeekRange(fromInput, toInput);

    const userFilter = userId
      ? Prisma.sql`AND r."userId" = ${userId}`
      : Prisma.empty;
    // Generate the series in SQL so requested weeks with no matches still appear.
    const data = await this.prisma.$queryRaw<CompletedTaskTrendRow[]>`
      WITH weeks AS (
        SELECT generate_series(
          ${from.toFormat('yyyy-MM-dd')}::date,
          ${to.toFormat('yyyy-MM-dd')}::date,
          INTERVAL '7 days'
        )::date AS week_start
      )
      SELECT
        TO_CHAR(weeks.week_start, 'YYYY-MM-DD') AS "weekStart",
        COUNT(task.id)::int AS "completedTasks"
      FROM weeks
      LEFT JOIN "Report" r
        ON r."weekStart" = weeks.week_start
        AND r.status IN ('SUBMITTED', 'APPROVED')
        ${userFilter}
      LEFT JOIN "ReportTask" task
        ON task."reportId" = r.id
        AND task.status = 'COMPLETED'
      GROUP BY weeks.week_start
      ORDER BY weeks.week_start
    `;

    return {
      from: from.toFormat('yyyy-MM-dd'),
      to: to.toFormat('yyyy-MM-dd'),
      data,
    };
  }

  async statusByMember(weekStartInput: string) {
    const timezone = this.config.get('REPORT_TIMEZONE', { infer: true });
    const weekStart = parseReportDate(weekStartInput, timezone);
    assertMonday(weekStart);
    const weekEnd = reportWeekEnd(weekStart);
    const weekEndExclusive = weekEnd
      .plus({ days: 1 })
      .startOf('day')
      .toJSDate();
    const weekStartDate = dateOnlyToDatabase(weekStart);

    const members = await this.prisma.user.findMany({
      where: {
        role: Role.MEMBER,
        isActive: true,
        createdAt: { lt: weekEndExclusive },
      },
      select: {
        id: true,
        name: true,
        reports: {
          where: { weekStart: weekStartDate },
          select: { status: true },
        },
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });

    return {
      weekStart: weekStart.toFormat('yyyy-MM-dd'),
      weekEnd: weekEnd.toFormat('yyyy-MM-dd'),
      data: members.map((member) => ({
        user: { id: member.id, name: member.name },
        status: member.reports[0]?.status ?? 'NOT_STARTED',
      })),
    };
  }

  async workloadByProject(fromInput: string, toInput: string) {
    const { from, to } = this.parseWeekRange(fromInput, toInput);
    // Aggregate in PostgreSQL to avoid loading every task row into the API process.
    const data = await this.prisma.$queryRaw<ProjectWorkloadRow[]>`
      SELECT
        p.id AS "projectId",
        p.name AS "projectName",
        COUNT(task.id)::int AS "taskCount",
        COALESCE(ROUND(SUM(task."spentHours")::numeric, 2), 0)::double precision
          AS "spentHours"
      FROM "Project" p
      JOIN "Report" r
        ON r."projectId" = p.id
        AND r."weekStart" >= ${from.toFormat('yyyy-MM-dd')}::date
        AND r."weekStart" <= ${to.toFormat('yyyy-MM-dd')}::date
        AND r.status IN ('SUBMITTED', 'APPROVED')
      LEFT JOIN "ReportTask" task ON task."reportId" = r.id
      GROUP BY p.id, p.name
      ORDER BY p.name, p.id
    `;

    return {
      from: from.toFormat('yyyy-MM-dd'),
      to: to.toFormat('yyyy-MM-dd'),
      data,
    };
  }

  async timeByType(fromInput: string, toInput: string) {
    const { from, to } = this.parseWeekRange(fromInput, toInput);
    const entries = await this.prisma.timeEntry.groupBy({
      by: ['taskType'],
      where: {
        report: {
          weekStart: {
            gte: dateOnlyToDatabase(from),
            lte: dateOnlyToDatabase(to),
          },
          status: { in: CONTENT_STATUSES },
        },
      },
      _sum: { hours: true },
      orderBy: { taskType: 'asc' },
    });
    const hoursByType = new Map(
      entries.map((entry) => [entry.taskType, entry._sum.hours ?? 0]),
    );

    return {
      from: from.toFormat('yyyy-MM-dd'),
      to: to.toFormat('yyyy-MM-dd'),
      data: Object.values(TaskType).map((taskType) => ({
        taskType,
        hours: Math.round((hoursByType.get(taskType) ?? 0) * 100) / 100,
      })),
    };
  }

  async activity(limit: number) {
    const [versions, reviews] = await Promise.all([
      this.prisma.reportVersion.findMany({
        take: limit,
        orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          versionNumber: true,
          submittedAt: true,
          submittedBy: { select: { id: true, name: true } },
          report: {
            select: {
              id: true,
              weekStart: true,
              user: { select: { id: true, name: true } },
            },
          },
        },
      }),
      this.prisma.review.findMany({
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          action: true,
          comment: true,
          createdAt: true,
          reviewer: { select: { id: true, name: true } },
          report: {
            select: {
              id: true,
              weekStart: true,
              user: { select: { id: true, name: true } },
            },
          },
        },
      }),
    ]);

    const items: Activity[] = [
      ...versions.map((version) => ({
        id: version.id,
        type: 'SUBMISSION' as const,
        timestamp: version.submittedAt,
        reportId: version.report.id,
        weekStart: databaseDateToOnly(version.report.weekStart),
        versionNumber: version.versionNumber,
        member: version.report.user,
        submittedBy: version.submittedBy,
      })),
      ...reviews.map((review) => ({
        id: review.id,
        type: 'REVIEW' as const,
        timestamp: review.createdAt,
        reportId: review.report.id,
        weekStart: databaseDateToOnly(review.report.weekStart),
        action: review.action,
        comment: review.comment,
        member: review.report.user,
        reviewer: review.reviewer,
      })),
    ];

    items.sort(
      (left, right) =>
        right.timestamp.getTime() - left.timestamp.getTime() ||
        right.id.localeCompare(left.id),
    );

    return {
      data: items.slice(0, limit),
    };
  }

  private parseWeekRange(fromInput: string, toInput: string) {
    const timezone = this.config.get('REPORT_TIMEZONE', { infer: true });
    const from = parseReportDate(fromInput, timezone);
    const to = parseReportDate(toInput, timezone);
    assertMonday(from);
    assertMonday(to);
    if (to.toMillis() < from.toMillis()) {
      throw new BadRequestException('to must be on or after from');
    }
    return { from, to };
  }
}
