import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { Env } from '../../config/env.validation.js';
import type { JwtPayload } from '../types/jwt-payload.js';
import { JwtStrategy } from './jwt.strategy.js';
import { describe, expect, it, vi } from 'vitest';

const activeSession = {
  id: 'session-id',
  user: {
    id: 'user-id',
    email: 'member@example.com',
    name: 'Member Name',
    role: 'MANAGER' as const,
    isActive: true,
    mustChangePassword: false,
  },
};

function createStrategy() {
  const prisma = {
    userSession: { findFirst: vi.fn() },
  } as unknown as PrismaService;
  const config = {
    getOrThrow: vi.fn().mockReturnValue('a-secret-at-least-32-bytes-long'),
  } as unknown as ConfigService<Env, true>;

  return { strategy: new JwtStrategy(config, prisma), prisma };
}

describe('JwtStrategy', () => {
  it('rejects tokens missing the user or session identifiers', async () => {
    const { strategy, prisma } = createStrategy();

    await expect(
      strategy.validate({ sub: 'user-id' } as JwtPayload),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.userSession.findFirst).not.toHaveBeenCalled();
  });

  it('rejects a missing, expired, revoked, or inactive-user session', async () => {
    const { strategy, prisma } = createStrategy();
    vi.mocked(prisma.userSession.findFirst).mockResolvedValue(null);

    await expect(
      strategy.validate({
        sub: 'user-id',
        jti: 'session-id',
        iat: 0,
        exp: 1,
        iss: 'sisenco-api',
        aud: 'sisenco-web',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.userSession.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'session-id',
        userId: 'user-id',
        revokedAt: null,
        expiresAt: { gt: expect.any(Date) },
        user: { isActive: true },
      },
      select: {
        id: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isActive: true,
            mustChangePassword: true,
          },
        },
      },
    });
  });

  it('returns the current database user and role for a valid session', async () => {
    const { strategy, prisma } = createStrategy();
    vi.mocked(prisma.userSession.findFirst).mockResolvedValue(
      activeSession as never,
    );

    await expect(
      strategy.validate({
        sub: 'user-id',
        jti: 'session-id',
        iat: 0,
        exp: 1,
        iss: 'sisenco-api',
        aud: 'sisenco-web',
      }),
    ).resolves.toEqual({ ...activeSession.user, sessionId: activeSession.id });
  });
});
