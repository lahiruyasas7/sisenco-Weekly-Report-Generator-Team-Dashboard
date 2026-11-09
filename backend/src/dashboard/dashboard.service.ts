import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DateTime } from 'luxon';
import { Prisma } from '../generated/prisma/client.js';
import { ReportStatus, Role } from '../generated/prisma/client.js';
import {
  assertMonday,
  dateOnlyToDatabase,
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
    const timezone = this.config.get('REPORT_TIMEZONE', { infer: true });
    const from = parseReportDate(fromInput, timezone);
    const to = parseReportDate(toInput, timezone);
    assertMonday(from);
    assertMonday(to);
    if (to.toMillis() < from.toMillis()) {
      throw new BadRequestException('to must be on or after from');
    }

    const userFilter = userId
      ? Prisma.sql`AND r."userId" = ${userId}`
      : Prisma.empty;
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
}
