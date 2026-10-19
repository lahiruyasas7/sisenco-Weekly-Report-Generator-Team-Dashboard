import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Role } from '../../generated/prisma/client.js';
import type { AuthenticatedUser } from '../types/authenticated-user.js';
import type { Env } from '../../config/env.validation.js';
import { ALLOW_PASSWORD_CHANGE_KEY } from '../../common/decorators/allow-password-change.decorator.js';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator.js';
import { ROLES_KEY } from '../../common/decorators/roles.decorator.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { PasswordChangeGuard } from './password-change.guard.js';
import { RolesGuard } from './roles.guard.js';
import { SameOriginGuard } from './same-origin.guard.js';
import { describe, expect, it, vi } from 'vitest';

const member = {
  id: 'user-id',
  email: 'member@example.com',
  name: 'Member Name',
  role: Role.MEMBER,
  isActive: true,
  mustChangePassword: false,
  sessionId: 'session-id',
} satisfies AuthenticatedUser;

describe('JwtAuthGuard', () => {
  it('skips JWT authentication for routes marked public', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(true),
    } as unknown as Reflector;
    const guard = new JwtAuthGuard(reflector);

    expect(guard.canActivate(createContext())).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
      undefined,
      undefined,
    ]);
  });
});

function createContext(user?: AuthenticatedUser, method = 'GET') {
  return {
    getHandler: vi.fn(),
    getClass: vi.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user, method, headers: {} }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('allows handlers without role metadata', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(undefined),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(createContext(member))).toBe(true);
  });

  it('allows a user with a required role and rejects other roles', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue([Role.ADMIN]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(createContext(member))).toBe(false);
    expect(
      guard.canActivate(createContext({ ...member, role: Role.ADMIN })),
    ).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
      undefined,
      undefined,
    ]);
  });
});

describe('PasswordChangeGuard', () => {
  it('blocks temporary-password users from other protected routes', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(undefined),
    } as unknown as Reflector;
    const guard = new PasswordChangeGuard(reflector);
    const temporaryPasswordUser = { ...member, mustChangePassword: true };

    expect(() =>
      guard.canActivate(createContext(temporaryPasswordUser)),
    ).toThrow(ForbiddenException);
  });

  it('allows designated password-change routes and normal users', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(true),
    } as unknown as Reflector;
    const guard = new PasswordChangeGuard(reflector);

    expect(
      guard.canActivate(createContext({ ...member, mustChangePassword: true })),
    ).toBe(true);
    expect(guard.canActivate(createContext(member))).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
      ALLOW_PASSWORD_CHANGE_KEY,
      [undefined, undefined],
    );
  });
});

describe('SameOriginGuard', () => {
  function createGuard() {
    const config = {
      getOrThrow: vi.fn().mockReturnValue('http://localhost:3000'),
    } as unknown as ConfigService<Env, true>;
    return new SameOriginGuard(config);
  }

  function contextWithRequest(
    method: string,
    headers: { origin?: string; referer?: string },
  ) {
    return {
      switchToHttp: () => ({ getRequest: () => ({ method, headers }) }),
    } as unknown as ExecutionContext;
  }

  it('allows same-origin browser mutations and safe methods', () => {
    const guard = createGuard();

    expect(
      guard.canActivate(
        contextWithRequest('POST', { origin: 'http://localhost:3000' }),
      ),
    ).toBe(true);
    expect(guard.canActivate(contextWithRequest('GET', {}))).toBe(true);
  });

  it('rejects cross-origin and malformed mutation origins', () => {
    const guard = createGuard();

    expect(() =>
      guard.canActivate(
        contextWithRequest('PATCH', { origin: 'https://attacker.example' }),
      ),
    ).toThrow(ForbiddenException);
    expect(() =>
      guard.canActivate(contextWithRequest('POST', { origin: 'not-a-url' })),
    ).toThrow(ForbiddenException);
  });

  it('allows non-browser clients without Origin or Referer headers', () => {
    expect(createGuard().canActivate(contextWithRequest('POST', {}))).toBe(
      true,
    );
  });
});
