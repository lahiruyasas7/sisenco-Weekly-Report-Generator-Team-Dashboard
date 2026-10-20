import { describe, expect, it } from 'vitest';
import { getAuthRedirect } from '@/lib/auth-routing';
import type { PublicUser, UserRole } from '@/lib/types';

function makeUser(role: UserRole, mustChangePassword = false): PublicUser {
  return {
    id: 'user-1',
    email: 'person@example.com',
    name: 'Person',
    role,
    isActive: true,
    mustChangePassword,
    createdAt: '2026-10-20T00:00:00.000Z',
  };
}

describe('getAuthRedirect', () => {
  it('sends temporary-password users to password change', () => {
    expect(getAuthRedirect(makeUser('MEMBER', true), '/')).toBe(
      '/change-password',
    );
  });

  it('keeps members out of manager routes', () => {
    expect(getAuthRedirect(makeUser('MEMBER'), '/manager/reports')).toBe('/');
  });

  it('allows admins on manager routes and limits admin routes to admins', () => {
    expect(getAuthRedirect(makeUser('ADMIN'), '/manager/dashboard')).toBeNull();
    expect(getAuthRedirect(makeUser('MANAGER'), '/admin/users')).toBe('/');
  });
});
