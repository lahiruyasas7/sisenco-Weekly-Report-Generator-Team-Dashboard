import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';
import { ACCESS_TOKEN_TTL_MS } from './auth.constants.js';
import { PasswordService } from './password.service.js';
import type { RegisterDto } from './dto/register.dto.js';
import type { AuthenticatedUser } from './types/authenticated-user.js';
import { describe, expect, it, vi } from 'vitest';

const user = {
  id: 'user-id',
  email: 'member@example.com',
  name: 'Member Name',
  role: 'MEMBER' as const,
  isActive: true,
  mustChangePassword: false,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

function createHarness() {
  const prisma = {
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    userSession: {
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  } as unknown as PrismaService;
  const jwtService = {
    signAsync: vi.fn().mockResolvedValue('signed-access-token'),
  } as unknown as JwtService;
  const passwords = {
    hash: vi.fn(),
    verify: vi.fn(),
  } as unknown as PasswordService;

  return {
    service: new AuthService(prisma, jwtService, passwords),
    prisma,
    jwtService,
    passwords,
  };
}

describe('AuthService', () => {
  it('registers a normalized MEMBER account with a hashed password', async () => {
    const { service, prisma, passwords } = createHarness();
    const input = {
      email: '  Member@Example.com ',
      name: ' Member Name ',
      password: 'StrongPassword!42',
    } satisfies RegisterDto;
    vi.mocked(passwords.hash).mockResolvedValue('password-hash');
    vi.mocked(prisma.user.create).mockResolvedValue(user as never);

    await expect(service.register(input)).resolves.toEqual(user);

    expect(passwords.hash).toHaveBeenCalledWith(input.password);
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        email: 'member@example.com',
        name: 'Member Name',
        passwordHash: 'password-hash',
        role: 'MEMBER',
      },
      select: expect.any(Object),
    });
    const createArgs = vi.mocked(prisma.user.create).mock.calls[0][0];
    expect(createArgs.select).not.toHaveProperty('passwordHash');
  });

  it('maps duplicate email errors to a conflict response', async () => {
    const { service, prisma, passwords } = createHarness();
    vi.mocked(passwords.hash).mockResolvedValue('password-hash');
    vi.mocked(prisma.user.create).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['email'] },
      }),
    );

    await expect(
      service.register({
        email: 'member@example.com',
        name: 'Member Name',
        password: 'StrongPassword!42',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates a database session and returns a signed token on valid login', async () => {
    const { service, prisma, jwtService, passwords } = createHarness();
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...user,
      passwordHash: 'password-hash',
    } as never);
    vi.mocked(passwords.verify).mockResolvedValue(true);
    vi.mocked(prisma.userSession.create).mockResolvedValue({} as never);

    const beforeLogin = Date.now();
    const result = await service.login(' MEMBER@EXAMPLE.COM ', 'password');
    const sessionData = vi.mocked(prisma.userSession.create).mock.calls[0][0]
      .data;

    expect(result).toEqual({ user, token: 'signed-access-token' });
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'member@example.com' } }),
    );
    expect(passwords.verify).toHaveBeenCalledWith('password', 'password-hash');
    expect(sessionData.userId).toBe(user.id);
    expect(sessionData.id).toBeDefined();
    expect(new Date(sessionData.expiresAt).getTime()).toBeGreaterThanOrEqual(
      beforeLogin + ACCESS_TOKEN_TTL_MS,
    );
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      {},
      { subject: user.id, jwtid: sessionData.id },
    );
  });

  it.each([
    ['unknown email', null, false],
    ['incorrect password', { ...user, passwordHash: 'password-hash' }, false],
    [
      'inactive account',
      { ...user, isActive: false, passwordHash: 'password-hash' },
      true,
    ],
  ])(
    'rejects login for %s with the same unauthorized error',
    async (_, dbUser, passwordMatches) => {
      const { service, prisma, passwords, jwtService } = createHarness();
      vi.mocked(prisma.user.findUnique).mockResolvedValue(dbUser as never);
      vi.mocked(passwords.verify).mockResolvedValue(passwordMatches);

      await expect(
        service.login('member@example.com', 'password'),
      ).rejects.toEqual(new UnauthorizedException('Invalid email or password'));
      expect(prisma.userSession.create).not.toHaveBeenCalled();
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    },
  );

  it('revokes the current session on logout', async () => {
    const { service, prisma } = createHarness();
    vi.mocked(prisma.userSession.updateMany).mockResolvedValue({ count: 1 });

    await service.logout('session-id');

    expect(prisma.userSession.updateMany).toHaveBeenCalledWith({
      where: { id: 'session-id', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('updates the password and revokes all active sessions after verification', async () => {
    const { service, prisma, passwords } = createHarness();
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      passwordHash: 'old-hash',
    } as never);
    vi.mocked(passwords.verify).mockResolvedValue(true);
    vi.mocked(passwords.hash).mockResolvedValue('new-hash');
    vi.mocked(prisma.user.update).mockResolvedValue({} as never);
    vi.mocked(prisma.userSession.updateMany).mockResolvedValue({ count: 2 });
    vi.mocked(prisma.$transaction).mockResolvedValue([] as never);

    await expect(
      service.changePassword('user-id', {
        currentPassword: 'old-password',
        newPassword: 'new-password',
      }),
    ).resolves.toBeUndefined();

    expect(passwords.verify).toHaveBeenCalledWith('old-password', 'old-hash');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-id' },
      data: { passwordHash: 'new-hash', mustChangePassword: false },
    });
    expect(prisma.userSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-id', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });

  it('rejects a password change when the current password is wrong', async () => {
    const { service, prisma, passwords } = createHarness();
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      passwordHash: 'old-hash',
    } as never);
    vi.mocked(passwords.verify).mockResolvedValue(false);

    await expect(
      service.changePassword('user-id', {
        currentPassword: 'wrong-password',
        newPassword: 'new-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(passwords.hash).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns the current user without selecting the password hash', async () => {
    const { service, prisma } = createHarness();
    vi.mocked(prisma.user.findUniqueOrThrow).mockResolvedValue(user as never);
    const authenticatedUser = {
      ...user,
      sessionId: 'session-id',
    } satisfies AuthenticatedUser;

    await expect(service.getCurrentUser(authenticatedUser)).resolves.toEqual(
      user,
    );
    expect(prisma.user.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: user.id },
      select: expect.not.objectContaining({ passwordHash: true }),
    });
  });

  // Additional tests for critical edge cases from CLAUDE.md

  it('normalizes email during login (trims and lowercases)', async () => {
    const { service, prisma, passwords } = createHarness();
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...user,
      passwordHash: 'password-hash',
    } as never);
    vi.mocked(passwords.verify).mockResolvedValue(true);
    vi.mocked(prisma.userSession.create).mockResolvedValue({} as never);

    await service.login('  MEMBER@EXAMPLE.COM  ', 'password');

    // Should have looked up the normalized email
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'member@example.com' } }),
    );
  });

  it('sets mustChangePassword to false after successful password change', async () => {
    const { service, prisma, passwords } = createHarness();
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      passwordHash: 'old-hash',
    } as never);
    vi.mocked(passwords.verify).mockResolvedValue(true);
    vi.mocked(passwords.hash).mockResolvedValue('new-hash');
    vi.mocked(prisma.user.update).mockResolvedValue({} as never);
    vi.mocked(prisma.userSession.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.$transaction).mockResolvedValue([] as never);

    await service.changePassword('user-id', {
      currentPassword: 'old-password',
      newPassword: 'new-password',
    });

    const updateArgs = vi.mocked(prisma.user.update).mock.calls[0][0];
    expect(updateArgs.data).toMatchObject({
      passwordHash: 'new-hash',
      mustChangePassword: false,
    });
  });

  it('invalidates all sessions on password change', async () => {
    const { service, prisma, passwords } = createHarness();
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      passwordHash: 'old-hash',
    } as never);
    vi.mocked(passwords.verify).mockResolvedValue(true);
    vi.mocked(passwords.hash).mockResolvedValue('new-hash');
    vi.mocked(prisma.user.update).mockResolvedValue({} as never);
    vi.mocked(prisma.userSession.updateMany).mockResolvedValue({ count: 3 }); // 3 sessions
    vi.mocked(prisma.$transaction).mockResolvedValue([] as never);

    await service.changePassword('user-id', {
      currentPassword: 'old-password',
      newPassword: 'new-password',
    });

    expect(prisma.userSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-id', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});
