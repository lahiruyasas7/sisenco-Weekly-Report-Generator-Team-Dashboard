import { InternalServerErrorException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, ReportStatus, Role } from '../generated/prisma/client.js';
import {
  assertMonday,
  dateOnlyToDatabase,
  databaseDateToOnly,
  parseReportDate,
  reportWeekEnd,
} from '../common/utils/week.util.js';
import type { Env } from '../config/env.validation.js';
import type { TeamSection } from './dto/team-sections-query.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class TeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async weekStatus(weekStartInput: string) {
    const { weekStart, weekEnd, weekEndExclusive } =
      this.parseWeek(weekStartInput);
    const members = await this.prisma.user.findMany({
      where: {
        role: Role.MEMBER,
        isActive: true,
        createdAt: { lt: weekEndExclusive },
      },
      select: { id: true, name: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });

    const reports = members.length
      ? await this.prisma.report.findMany({
          where: {
            userId: { in: members.map((member) => member.id) },
            weekStart: dateOnlyToDatabase(weekStart),
          },
          select: { id: true, userId: true, status: true },
        })
      : [];
    const reportByMember = new Map(
      reports.map((report) => [report.userId, report]),
    );

    return {
      weekStart: databaseDateToOnly(dateOnlyToDatabase(weekStart)),
      weekEnd: databaseDateToOnly(dateOnlyToDatabase(weekEnd)),
      data: members.map((member) => {
        const report = reportByMember.get(member.id);
        const status = report?.status ?? 'NOT_STARTED';
        return {
          user: member,
          status,
          ...(report?.status === ReportStatus.DRAFT
            ? {}
            : { reportId: report?.id ?? null }),
        };
      }),
    };
  }

  async sections(weekStartInput: string, section: TeamSection) {
    const { weekStart, weekEnd, weekEndExclusive } =
      this.parseWeek(weekStartInput);
    const reports = await this.prisma.report.findMany({
      where: {
        weekStart: dateOnlyToDatabase(weekStart),
        status: { in: [ReportStatus.SUBMITTED, ReportStatus.APPROVED] },
        user: {
          role: Role.MEMBER,
          isActive: true,
          createdAt: { lt: weekEndExclusive },
        },
      },
      select: {
        id: true,
        userId: true,
        currentVersion: true,
        user: { select: { id: true, name: true } },
      },
      orderBy: [{ user: { name: 'asc' } }, { userId: 'asc' }],
    });

    const versions = reports.length
      ? await this.prisma.reportVersion.findMany({
          where: {
            reportId: { in: reports.map((report) => report.id) },
            versionNumber: {
              in: reports.map((report) => report.currentVersion),
            },
          },
          select: { reportId: true, versionNumber: true, snapshot: true },
        })
      : [];
    const versionByReport = new Map(
      versions.map((version) => [
        `${version.reportId}:${version.versionNumber}`,
        version.snapshot,
      ]),
    );

    return {
      weekStart: databaseDateToOnly(dateOnlyToDatabase(weekStart)),
      weekEnd: databaseDateToOnly(dateOnlyToDatabase(weekEnd)),
      section,
      data: reports.map((report) => {
        const snapshot = versionByReport.get(
          `${report.id}:${report.currentVersion}`,
        );
        if (snapshot === undefined) {
          throw new InternalServerErrorException(
            'The current report version is unavailable',
          );
        }
        return {
          user: report.user,
          reportId: report.id,
          content: sectionContent(snapshot, section),
        };
      }),
    };
  }

  private parseWeek(weekStartInput: string) {
    const timezone = this.config.get('REPORT_TIMEZONE', { infer: true });
    const weekStart = parseReportDate(weekStartInput, timezone);
    assertMonday(weekStart);
    const weekEnd = reportWeekEnd(weekStart);
    const weekEndExclusive = weekEnd
      .plus({ days: 1 })
      .startOf('day')
      .toJSDate();
    return { weekStart, weekEnd, weekEndExclusive };
  }
}

function sectionContent(
  snapshot: Prisma.JsonValue,
  section: TeamSection,
): Prisma.JsonValue {
  if (
    snapshot === null ||
    Array.isArray(snapshot) ||
    typeof snapshot !== 'object'
  ) {
    throw new InternalServerErrorException(
      'The report snapshot has an invalid shape',
    );
  }

  const key = section === 'nextWeek' ? 'nextWeekTasks' : section;
  const content = snapshot[key];
  if (
    (section === 'notes' && typeof content === 'string') ||
    (section !== 'notes' && Array.isArray(content))
  ) {
    return content;
  }
  throw new InternalServerErrorException(
    'The report snapshot is missing the requested section',
  );
}
