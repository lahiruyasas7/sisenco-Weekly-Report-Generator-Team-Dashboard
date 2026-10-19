import { ForbiddenException } from '@nestjs/common';
import { Role } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PasswordService } from '../auth/password.service.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.js';
import type { CreateUserDto } from './dto/create-user.dto.js';
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
    count: vi.fn(),
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
    $transaction: transactionMock,
  } as unknown as PrismaService;
  const passwords = {
    hash: vi.fn(),
  } as unknown as PasswordService;

  return {
    service: new UsersService(prisma, passwords),
    prisma,
    user,
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
});
