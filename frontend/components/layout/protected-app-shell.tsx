'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useLogout } from '@/lib/hooks/use-auth';
import type { PublicUser } from '@/lib/types';

export function ProtectedAppShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: PublicUser;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const logout = useLogout();
  const [logoutError, setLogoutError] = useState('');

  async function handleLogout() {
    setLogoutError('');
    try {
      await logout.mutateAsync();
      router.replace('/login');
    } catch (error) {
      setLogoutError(
        error instanceof Error
          ? error.message
          : 'Unable to sign out. Please try again.',
      );
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f7f5] font-sans text-[#202623]">
      <header className="border-b border-[#dedfdc] bg-white">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <span className="text-sm font-semibold text-[#08796f]">
            Weekly Reports
          </span>
          <nav
            aria-label="Main navigation"
            className="flex items-center gap-3 text-sm sm:gap-5"
          >
            {[
              { href: '/', label: 'Home' },
              { href: '/settings', label: 'Settings' },
              ...(user.role === 'ADMIN'
                ? [{ href: '/admin/users', label: 'Users' }]
                : []),
            ].map(({ href, label }) => {
              const isCurrent =
                href === '/' ? pathname === '/' : pathname.startsWith(href);

              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={isCurrent ? 'page' : undefined}
                  className={
                    isCurrent
                      ? 'font-semibold text-[#08796f]'
                      : 'text-[#545f5b] hover:text-[#08796f]'
                  }
                >
                  {label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-[#66716d]">
                {user.role.toLowerCase()}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              disabled={logout.isPending}
              className="rounded-md border border-[#d7dcd8] px-3 py-2 text-sm font-medium text-[#38433e] transition-colors hover:bg-[#f6f7f5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0c7c72] disabled:cursor-not-allowed disabled:opacity-65"
            >
              {logout.isPending ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
        {logoutError ? (
          <p className="mb-5 text-sm text-red-700" role="alert">
            {logoutError}
          </p>
        ) : null}
        {children}
      </main>
    </div>
  );
}
