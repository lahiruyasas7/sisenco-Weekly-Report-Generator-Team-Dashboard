import type { PublicUser } from '@/lib/types';

function isPathOrChild(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

export function getAuthRedirect(
  user: PublicUser,
  pathname: string,
): string | null {
  if (user.mustChangePassword) {
    return pathname === '/change-password' ? null : '/change-password';
  }

  if (isPathOrChild(pathname, '/change-password')) {
    return '/';
  }

  if (user.role === 'MEMBER' && isPathOrChild(pathname, '/manager')) {
    return '/';
  }

  if (user.role !== 'ADMIN' && isPathOrChild(pathname, '/admin')) {
    return '/';
  }

  return null;
}
