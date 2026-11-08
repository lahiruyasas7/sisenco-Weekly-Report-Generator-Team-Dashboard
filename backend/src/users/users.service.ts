import {
  ConflictException,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, ReportStatus, Role } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PasswordService } from '../auth/password.service.js';
import type { PublicUser } from '../auth/auth.service.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.js';
import type { Env } from '../config/env.validation.js';
import type { CreateUserDto } from './dto/create-user.dto.js';
import type { ListUsersDto } from './dto/list-users.dto.js';
import type { ListTeamUsersDto } from './dto/list-team-users.dto.js';
import type { UpdateUserDto } from './dto/update-user.dto.js';

const safeUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  mustChangePassword: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async list(input: ListUsersDto) {
    const search = input.search?.trim();
    const where: Prisma.UserWhereInput = {
      ...(input.role ? { role: input.role } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' } },
              { name: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const skip = (input.page - 1) * input.limit;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: safeUserSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip,
        take: input.limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data,
      meta: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: Math.ceil(total / input.limit),
      },
    };
  }

  async listTeam(input: ListTeamUsersDto) {
    const where = { role: Role.MEMBER, isActive: true };
    const skip = (input.page - 1) * input.limit;
    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: { id: true, name: true },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip,
        take: input.limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    const reportsByUser = new Map<string, Record<ReportStatus, number>>();
    for (const user of users) {
      reportsByUser.set(user.id, {
        [ReportStatus.DRAFT]: 0,
        [ReportStatus.SUBMITTED]: 0,
        [ReportStatus.NEEDS_CORRECTION]: 0,
        [ReportStatus.APPROVED]: 0,
      });
    }

    if (users.length > 0) {
      const groupedReports = await this.prisma.report.groupBy({
        by: ['userId', 'status'],
        where: { userId: { in: users.map((user) => user.id) } },
        _count: { _all: true },
      });
      for (const reportGroup of groupedReports) {
        const counts = reportsByUser.get(reportGroup.userId);
        if (!counts) {
          throw new InternalServerErrorException(
            'Report counts were returned for an unknown team member',
          );
        }
        counts[reportGroup.status] = reportGroup._count._all;
      }
    }

    return {
      data: users.map((user) => {
        const reportsByStatus = reportsByUser.get(user.id);
        if (!reportsByStatus) {
          throw new InternalServerErrorException(
            'Report counts were not initialized for a team member',
          );
        }
        return { ...user, reportsByStatus };
      }),
      meta: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: Math.ceil(total / input.limit),
      },
    };
  }

  async profile(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, role: Role.MEMBER },
      select: { id: true, name: true, isActive: true, createdAt: true },
    });
    if (!user) throw new NotFoundException('Member not found');

    const timezone = this.config.get('REPORT_TIMEZONE', { infer: true });
    const dueOffsetDays = this.config.get('REPORT_DUE_OFFSET_DAYS', {
      infer: true,
    });
    const [aggregates] = await this.prisma.$queryRaw<ProfileAggregate[]>`
      SELECT
        COUNT(*) FILTER (WHERE "status" = 'DRAFT') AS "draftCount",
        COUNT(*) FILTER (WHERE "status" = 'SUBMITTED') AS "submittedCount",
        COUNT(*) FILTER (WHERE "status" = 'NEEDS_CORRECTION') AS "needsCorrectionCount",
        COUNT(*) FILTER (WHERE "status" = 'APPROVED') AS "approvedCount",
        CASE
          WHEN COUNT("firstSubmittedAt") = 0 THEN NULL
          ELSE COUNT(*) FILTER (
            WHERE "firstSubmittedAt" <=
              (("weekStart" + ${dueOffsetDays})::timestamp AT TIME ZONE ${timezone})
          )::double precision / COUNT("firstSubmittedAt")::double precision
        END AS "onTimeRate",
        COALESCE((
          SELECT ROUND(AVG(weekly_hours.total_hours)::numeric, 2)::double precision
          FROM (
            SELECT r2.id, COALESCE(SUM(t."spentHours"), 0) AS total_hours
            FROM "Report" r2
            LEFT JOIN "ReportTask" t ON t."reportId" = r2.id
            WHERE r2."userId" = ${userId}
              AND r2."status" IN ('SUBMITTED', 'APPROVED')
            GROUP BY r2.id
          ) weekly_hours
        ), 0)::double precision AS "averageWeeklySpentHours"
      FROM "Report" r
      WHERE r."userId" = ${userId}
    `;

    if (!aggregates) {
      throw new InternalServerErrorException(
        'Member report aggregates were not returned',
      );
    }

    return {
      user,
      stats: {
        reportsByStatus: {
          [ReportStatus.DRAFT]: Number(aggregates.draftCount),
          [ReportStatus.SUBMITTED]: Number(aggregates.submittedCount),
          [ReportStatus.NEEDS_CORRECTION]: Number(
            aggregates.needsCorrectionCount,
          ),
          [ReportStatus.APPROVED]: Number(aggregates.approvedCount),
        },
        onTimeRate: aggregates.onTimeRate,
        averageWeeklySpentHours: aggregates.averageWeeklySpentHours,
      },
    };
  }

  async create(input: CreateUserDto): Promise<PublicUser> {
    const passwordHash = await this.passwords.hash(input.temporaryPassword);
    try {
      return await this.prisma.user.create({
        data: {
          email: input.email.trim().toLowerCase(),
          name: input.name.trim(),
          role: input.role,
          passwordHash,
          mustChangePassword: true,
        },
        select: safeUserSelect,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'An account with this email already exists',
        );
      }
      throw error;
    }
  }

  async update(
    actor: AuthenticatedUser,
    userId: string,
    input: UpdateUserDto,
  ): Promise<PublicUser> {
    if (
      input.name === undefined &&
      input.role === undefined &&
      input.isActive === undefined
    ) {
      throw new BadRequestException('Provide at least one field to update');
    }

    if (actor.id === userId && input.isActive === false) {
      throw new ForbiddenException('You cannot deactivate your own account');
    }

    try {
      return await this.prisma.$transaction(
        async (transaction) => {
          const current = await transaction.user.findUnique({
            where: { id: userId },
            select: { role: true, isActive: true },
          });
          if (!current) throw new NotFoundException('User not found');

          const isRemovingActiveAdmin =
            current.role === Role.ADMIN &&
            current.isActive &&
            ((input.role !== undefined && input.role !== Role.ADMIN) ||
              input.isActive === false);

          if (isRemovingActiveAdmin) {
            const activeAdmins = await transaction.user.count({
              where: { role: Role.ADMIN, isActive: true },
            });
            if (activeAdmins <= 1) {
              throw new ForbiddenException(
                'The last active admin cannot be demoted or deactivated',
              );
            }
          }

          const updated = await transaction.user.update({
            where: { id: userId },
            data: {
              ...(input.name !== undefined ? { name: input.name.trim() } : {}),
              ...(input.role !== undefined ? { role: input.role } : {}),
              ...(input.isActive !== undefined
                ? { isActive: input.isActive }
                : {}),
            },
            select: safeUserSelect,
          });

          if (input.isActive === false) {
            await transaction.userSession.updateMany({
              where: { userId, revokedAt: null },
              data: { revokedAt: new Date() },
            });
          }

          return updated;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        throw new ConflictException(
          'A concurrent user update prevented this change; retry the request',
        );
      }
      throw error;
    }
  }

  async deactivate(actor: AuthenticatedUser, userId: string): Promise<void> {
    await this.update(actor, userId, { isActive: false });
  }
}

type ProfileAggregate = {
  draftCount: bigint;
  submittedCount: bigint;
  needsCorrectionCount: bigint;
  approvedCount: bigint;
  onTimeRate: number | null;
  averageWeeklySpentHours: number;
};
