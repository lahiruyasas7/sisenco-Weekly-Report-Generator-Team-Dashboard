import { ForbiddenException } from '@nestjs/common';
import { Role } from '../generated/prisma/client.js';
import { ReportStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PasswordService } from '../auth/password.service.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.js';
import type { CreateUserDto } from './dto/create-user.dto.js';
import type { ListTeamUsersDto } from './dto/list-team-users.dto.js';
import type { ListUsersDto } from './dto/list-users.dto.js';
import type { UpdateUserDto } from './dto/update-user.dto.js';
import { UsersService } from './users.service.js';
import { describe, expect, it, vi } from 'vitest';

const admin = {
  id: 'admin-id',
  email: 'admin@example.com',
  name: 'Admin User',
  role: Role.ADMIN,
  isActive: true,
  mustChangePassword: false,
  sessionId: 'admin-session',
} satisfies AuthenticatedUser;

function createHarness() {
  const transaction = {
    user: {
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    userSession: { updateMany: vi.fn() },
  };
  const user = {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
  };
  const report = {
    groupBy: vi.fn(),
  };
  const config = {
    get: vi.fn((key: string) =>
      key === 'REPORT_TIMEZONE' ? 'Asia/Colombo' : 7,
    ),
  };
  const transactionMock = vi.fn((operation: unknown) => {
    if (Array.isArray(operation)) return Promise.all(operation);
    if (typeof operation === 'function') {
      return Promise.resolve(
        Reflect.apply(operation, undefined, [transaction]),
      );
    }
    throw new Error('Unsupported transaction argument in this test');
  });
  const prisma = {
    user,
    report,
    $queryRaw: vi.fn(),
    $transaction: transactionMock,
  } as unknown as PrismaService;
  const passwords = {
    hash: vi.fn(),
  } as unknown as PasswordService;

  return {
    service: new UsersService(prisma, passwords, config as never),
    prisma,
    user,
    report,
    config,
    transaction,
    passwords,
  };
}

describe('UsersService', () => {
  it('prevents an admin from deactivating their own account', async () => {
    const { service, prisma } = createHarness();

    await expect(service.deactivate(admin, admin.id)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('prevents demoting the last active admin', async () => {
    const { service, prisma, transaction } = createHarness();
    vi.mocked(transaction.user.findUnique).mockResolvedValue({
      role: Role.ADMIN,
      isActive: true,
    } as never);
    vi.mocked(transaction.user.count).mockResolvedValue(1);

    await expect(
      service.update(admin, 'another-admin-id', { role: Role.MANAGER }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(transaction.user.update).not.toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: 'Serializable' }),
    );
  });

  it('revokes a deactivated user’s active sessions', async () => {
    const { service, transaction } = createHarness();
    const targetId = 'member-id';
    const deactivatedUser = {
      id: targetId,
      email: 'member@example.com',
      name: 'Member User',
      role: Role.MEMBER,
      isActive: false,
      mustChangePassword: false,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    vi.mocked(transaction.user.findUnique).mockResolvedValue({
      role: Role.MEMBER,
      isActive: true,
    } as never);
    vi.mocked(transaction.user.update).mockResolvedValue(
      deactivatedUser as never,
    );
    vi.mocked(transaction.userSession.updateMany).mockResolvedValue({
      count: 1,
    });

    await expect(service.deactivate(admin, targetId)).resolves.toBeUndefined();

    expect(transaction.userSession.updateMany).toHaveBeenCalledWith({
      where: { userId: targetId, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('creates users with a hashed temporary password and forces a password change', async () => {
    const { service, user, passwords } = createHarness();
    const newUser = {
      id: 'new-user-id',
      email: 'newuser@example.com',
      name: 'New User',
      role: Role.MEMBER,
      isActive: true,
      mustChangePassword: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    const input = {
      email: ' NewUser@Example.com ',
      name: ' New User ',
      role: Role.MEMBER,
      temporaryPassword: 'TemporaryPassword123',
    } satisfies CreateUserDto;
    vi.mocked(user.create).mockResolvedValue(newUser as never);
    vi.mocked(passwords.hash).mockResolvedValue('hashed-password');

    await expect(service.create(input)).resolves.toEqual(newUser);

    expect(passwords.hash).toHaveBeenCalledWith(input.temporaryPassword);
    expect(user.create).toHaveBeenCalledWith({
      data: {
        email: 'newuser@example.com',
        name: 'New User',
        role: Role.MEMBER,
        passwordHash: 'hashed-password',
        mustChangePassword: true,
      },
      select: expect.not.objectContaining({ passwordHash: true }),
    });
  });

  it('updates supported user fields and role', async () => {
    const { service, transaction } = createHarness();
    const updatedUser = {
      id: 'user-id',
      email: 'member@example.com',
      name: 'Updated Name',
      role: Role.MANAGER,
      isActive: true,
      mustChangePassword: false,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    vi.mocked(transaction.user.findUnique).mockResolvedValue({
      role: Role.MEMBER,
      isActive: true,
    } as never);
    vi.mocked(transaction.user.update).mockResolvedValue(updatedUser as never);

    const input = {
      name: ' Updated Name ',
      role: Role.MANAGER,
    } satisfies UpdateUserDto;
    await expect(service.update(admin, 'user-id', input)).resolves.toEqual(
      updatedUser,
    );

    expect(transaction.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-id' },
        data: { name: 'Updated Name', role: Role.MANAGER },
      }),
    );
  });

  it('lists users with filters and pagination', async () => {
    const { service, prisma, user } = createHarness();
    const users = [
      {
        id: 'user1',
        email: 'user1@example.com',
        name: 'User One',
        role: Role.MEMBER,
        isActive: true,
        mustChangePassword: false,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ];
    vi.mocked(user.findMany).mockResolvedValue(users as never);
    vi.mocked(user.count).mockResolvedValue(1);
    const query = {
      page: 2,
      limit: 10,
      search: ' user ',
      role: Role.MEMBER,
      isActive: true,
    } satisfies ListUsersDto;

    await expect(service.list(query)).resolves.toEqual({
      data: users,
      meta: { page: 2, limit: 10, total: 1, totalPages: 1 },
    });

    expect(user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { email: { contains: 'user', mode: 'insensitive' } },
            { name: { contains: 'user', mode: 'insensitive' } },
          ],
          role: Role.MEMBER,
          isActive: true,
        },
        skip: 10,
        take: 10,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      }),
    );
    expect(user.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ role: Role.MEMBER, isActive: true }),
    });
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });

  it('returns an empty user list with zero pages', async () => {
    const { service, user } = createHarness();
    vi.mocked(user.findMany).mockResolvedValue([]);
    vi.mocked(user.count).mockResolvedValue(0);

    await expect(service.list({ page: 1, limit: 20 })).resolves.toEqual({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
  });

  it('lists active members with paginated all-time counts by status', async () => {
    const { service, user, report, prisma } = createHarness();
    const members = [
      { id: 'member-1', name: 'Member One' },
      { id: 'member-2', name: 'Member Two' },
    ];
    vi.mocked(user.findMany).mockResolvedValue(members as never);
    vi.mocked(user.count).mockResolvedValue(3);
    vi.mocked(report.groupBy).mockResolvedValue([
      {
        userId: 'member-1',
        status: ReportStatus.APPROVED,
        _count: { _all: 4 },
      },
      {
        userId: 'member-1',
        status: ReportStatus.SUBMITTED,
        _count: { _all: 2 },
      },
      {
        userId: 'member-2',
        status: ReportStatus.DRAFT,
        _count: { _all: 1 },
      },
    ] as never);
    const query = { page: 2, limit: 2 } satisfies ListTeamUsersDto;

    await expect(service.listTeam(query)).resolves.toEqual({
      data: [
        {
          ...members[0],
          reportsByStatus: {
            DRAFT: 0,
            SUBMITTED: 2,
            NEEDS_CORRECTION: 0,
            APPROVED: 4,
          },
        },
        {
          ...members[1],
          reportsByStatus: {
            DRAFT: 1,
            SUBMITTED: 0,
            NEEDS_CORRECTION: 0,
            APPROVED: 0,
          },
        },
      ],
      meta: { page: 2, limit: 2, total: 3, totalPages: 2 },
    });

    expect(user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { role: Role.MEMBER, isActive: true },
        select: { id: true, name: true },
        skip: 2,
        take: 2,
      }),
    );
    expect(report.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['userId', 'status'],
        where: { userId: { in: ['member-1', 'member-2'] } },
      }),
    );
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });

  it('does not query report counts when the team page is empty', async () => {
    const { service, user, report } = createHarness();
    vi.mocked(user.findMany).mockResolvedValue([]);
    vi.mocked(user.count).mockResolvedValue(0);

    await expect(service.listTeam({ page: 1, limit: 20 })).resolves.toEqual({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
    expect(report.groupBy).not.toHaveBeenCalled();
  });

  it('returns all-time profile statistics for a member', async () => {
    const { service, user, prisma, config } = createHarness();
    const member = {
      id: 'member-1',
      name: 'Member One',
      isActive: false,
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
    };
    vi.mocked(user.findFirst).mockResolvedValue(member as never);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([
      {
        draftCount: 1n,
        submittedCount: 2n,
        needsCorrectionCount: 3n,
        approvedCount: 4n,
        onTimeRate: 0.75,
        averageWeeklySpentHours: 31.25,
      },
    ] as never);

    await expect(service.profile(member.id)).resolves.toEqual({
      user: member,
      stats: {
        reportsByStatus: {
          DRAFT: 1,
          SUBMITTED: 2,
          NEEDS_CORRECTION: 3,
          APPROVED: 4,
        },
        onTimeRate: 0.75,
        averageWeeklySpentHours: 31.25,
      },
    });
    expect(user.findFirst).toHaveBeenCalledWith({
      where: { id: member.id, role: Role.MEMBER },
      select: { id: true, name: true, isActive: true, createdAt: true },
    });
    expect(config.get).toHaveBeenCalledWith('REPORT_TIMEZONE', {
      infer: true,
    });
    expect(config.get).toHaveBeenCalledWith('REPORT_DUE_OFFSET_DAYS', {
      infer: true,
    });
    expect(prisma.$queryRaw).toHaveBeenCalledOnce();
  });

  it('returns a null on-time rate when a member has no submitted reports', async () => {
    const { service, user, prisma } = createHarness();
    vi.mocked(user.findFirst).mockResolvedValue({
      id: 'member-1',
      name: 'Member One',
      isActive: true,
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
    } as never);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([
      {
        draftCount: 2n,
        submittedCount: 0n,
        needsCorrectionCount: 0n,
        approvedCount: 0n,
        onTimeRate: null,
        averageWeeklySpentHours: 0,
      },
    ] as never);

    await expect(service.profile('member-1')).resolves.toMatchObject({
      stats: {
        onTimeRate: null,
        averageWeeklySpentHours: 0,
      },
    });
  });

  it('returns 404 for an unknown or non-member profile', async () => {
    const { service, user, prisma } = createHarness();
    vi.mocked(user.findFirst).mockResolvedValue(null);

    await expect(service.profile('user-id')).rejects.toMatchObject({
      status: 404,
    });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});
