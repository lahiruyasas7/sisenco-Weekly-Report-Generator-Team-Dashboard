import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import type { PublicUser } from './auth.service.js';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { ACCESS_TOKEN_COOKIE } from './auth.constants.js';
import { authCookieOptions } from './auth-cookie.js';
import type { Env } from '../config/env.validation.js';
import type { AuthenticatedUser } from './types/authenticated-user.js';
import type { RegisterDto } from './dto/register.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import type { ChangePasswordDto } from './dto/change-password.dto.js';
import type { UpdateProfileDto } from './dto/update-profile.dto.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUser: PublicUser = {
  id: 'user-id',
  email: 'member@example.com',
  name: 'Member Name',
  role: 'MEMBER',
  isActive: true,
  mustChangePassword: false,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

const authenticatedUser: AuthenticatedUser = {
  ...mockUser,
  sessionId: 'session-id',
};

const mockAuthService = {
  register: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  changePassword: vi.fn(),
  getCurrentUser: vi.fn(),
  updateProfile: vi.fn(),
};

describe('AuthController', () => {
  let controller: AuthController;
  const response = {
    cookie: vi.fn(),
    clearCookie: vi.fn(),
  } as unknown as Response;

  beforeEach(() => {
    vi.clearAllMocks();
    const config = {
      get: vi.fn().mockReturnValue('development'),
    } as unknown as ConfigService<Env, true>;

    controller = new AuthController(
      mockAuthService as unknown as AuthService,
      config,
    );
  });

  it('registers a user and returns the service result', async () => {
    const input: RegisterDto = {
      email: 'member@example.com',
      name: 'Member Name',
      password: 'StrongPassword!42',
    };
    mockAuthService.register.mockResolvedValue(mockUser);

    await expect(controller.register(input)).resolves.toEqual(mockUser);
    expect(mockAuthService.register).toHaveBeenCalledWith(input);
  });

  it('sets the access cookie on login and returns only the public user', async () => {
    const input: LoginDto = {
      email: 'member@example.com',
      password: 'StrongPassword!42',
    };
    mockAuthService.login.mockResolvedValue({ user: mockUser, token: 'jwt' });

    await expect(controller.login(input, response)).resolves.toEqual(mockUser);
    expect(mockAuthService.login).toHaveBeenCalledWith(
      input.email,
      input.password,
    );
    expect(response.cookie).toHaveBeenCalledWith(
      ACCESS_TOKEN_COOKIE,
      'jwt',
      authCookieOptions(false),
    );
  });

  it('revokes the current session and clears the cookie on logout', async () => {
    await expect(
      controller.logout(authenticatedUser, response),
    ).resolves.toBeUndefined();

    expect(mockAuthService.logout).toHaveBeenCalledWith('session-id');
    expect(response.clearCookie).toHaveBeenCalledWith(
      ACCESS_TOKEN_COOKIE,
      authCookieOptions(false),
    );
  });

  it('changes the current user password and clears the cookie', async () => {
    const input: ChangePasswordDto = {
      currentPassword: 'current-password',
      newPassword: 'a sufficiently strong new password',
    };

    await expect(
      controller.changePassword(authenticatedUser, input, response),
    ).resolves.toBeUndefined();

    expect(mockAuthService.changePassword).toHaveBeenCalledWith(
      'user-id',
      input,
    );
    expect(response.clearCookie).toHaveBeenCalledWith(
      ACCESS_TOKEN_COOKIE,
      authCookieOptions(false),
    );
  });

  it('returns the authenticated user profile', async () => {
    mockAuthService.getCurrentUser.mockResolvedValue(mockUser);

    await expect(controller.me(authenticatedUser)).resolves.toEqual(mockUser);
    expect(mockAuthService.getCurrentUser).toHaveBeenCalledWith(
      authenticatedUser,
    );
  });

  it('updates the authenticated user profile', async () => {
    const input: UpdateProfileDto = { name: 'Updated Name' };
    const updatedUser = { ...mockUser, name: 'Updated Name' };
    mockAuthService.updateProfile.mockResolvedValue(updatedUser);

    await expect(
      controller.updateProfile(authenticatedUser, input),
    ).resolves.toEqual(updatedUser);
    expect(mockAuthService.updateProfile).toHaveBeenCalledWith(
      'user-id',
      input,
    );
  });
});
