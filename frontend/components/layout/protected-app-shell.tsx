'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { useLogout } from '@/lib/hooks/use-auth';
import type { PublicUser, UserRole } from '@/lib/types';

type NavigationItem = {
  href: string;
  label: string;
};

function getNavigationItems(role: UserRole): NavigationItem[] {
  const isManager = role === 'MANAGER' || role === 'ADMIN';

  return [
    { href: '/', label: 'Dashboard' },
    { href: isManager ? '/manager/reports' : '/reports', label: 'Reports' },
    ...(isManager ? [{ href: '/manager/sections', label: 'Sections' }] : []),
    { href: '/projects', label: 'Projects' },
    ...(role === 'ADMIN' ? [{ href: '/admin/users', label: 'Users' }] : []),
    { href: '/settings', label: 'Settings' },
  ];
}

function NavigationLinks({
  items,
  pathname,
  onNavigate,
}: {
  items: NavigationItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Main navigation" className="flex flex-col gap-1">
      {items.map(({ href, label }) => {
        const isCurrent =
          href === '/' ? pathname === '/' : pathname.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            aria-current={isCurrent ? 'page' : undefined}
            onClick={onNavigate}
            className={`rounded-md px-2.5 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
              isCurrent
                ? 'bg-[#20584f] font-medium text-white'
                : 'text-[#d2e0dc] hover:bg-[#19483f] hover:text-white'
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function AccountDetails({ user }: { user: PublicUser }) {
  return (
    <div className="min-w-0 text-sm text-[#b8d0ca]">
      <p className="truncate font-medium text-white">{user.name}</p>
      <p className="truncate text-xs">{user.role.toLowerCase()}</p>
    </div>
  );
}

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
  const mobileMenuRef = useRef<HTMLDialogElement>(null);
  const [logoutError, setLogoutError] = useState('');
  const navigationItems = getNavigationItems(user.role);

  async function handleLogout() {
    setLogoutError('');
    try {
      await logout.mutateAsync();
      router.replace('/login');
    } catch (error) {
      closeMobileMenu();
      setLogoutError(
        error instanceof Error
          ? error.message
          : 'Unable to sign out. Please try again.',
      );
    }
  }

  function closeMobileMenu() {
    mobileMenuRef.current?.close();
  }

  return (
    <div className="flex min-h-screen bg-[#f6f7f5] font-sans text-[#202623]">
      <aside className="hidden w-[210px] shrink-0 flex-col bg-[#10332f] px-3.5 py-5 md:flex">
        <Link
          href="/"
          className="mb-6 px-2 text-base font-bold text-white focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Weekly Reports
        </Link>
        <NavigationLinks items={navigationItems} pathname={pathname} />

        <div className="mt-auto space-y-5 px-2 pt-8">
          <AccountDetails user={user} />
          <button
            type="button"
            onClick={handleLogout}
            disabled={logout.isPending}
            className="text-sm font-medium text-[#d2e0dc] hover:text-white focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-65"
          >
            {logout.isPending ? 'Signing out…' : 'Log out'}
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="flex min-h-14 items-center justify-between border-b border-[#dedfdc] bg-white px-4 md:hidden">
          <Link href="/" className="text-sm font-bold text-[#103f39]">
            Weekly Reports
          </Link>
          <button
            type="button"
            aria-label="Open navigation menu"
            aria-haspopup="dialog"
            onClick={() => mobileMenuRef.current?.showModal()}
            className="inline-flex size-10 items-center justify-center rounded-md text-[#103f39] hover:bg-[#eef3f1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0c7c72]"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="size-5"
            >
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </header>

        <dialog
          ref={mobileMenuRef}
          aria-labelledby="mobile-navigation-title"
          onClick={(event) => {
            if (event.target === mobileMenuRef.current) closeMobileMenu();
          }}
          className="m-0 h-dvh max-h-none w-[min(18rem,85vw)] max-w-none border-0 bg-[#10332f] p-0 text-white shadow-xl backdrop:bg-black/50 open:fixed open:left-0 open:top-0"
        >
          <div className="flex h-full flex-col px-3.5 py-5">
            <div className="mb-6 flex items-center justify-between gap-3 px-2">
              <Link
                href="/"
                id="mobile-navigation-title"
                onClick={closeMobileMenu}
                className="text-base font-bold text-white"
              >
                Weekly Reports
              </Link>
              <button
                type="button"
                aria-label="Close navigation menu"
                onClick={closeMobileMenu}
                className="inline-flex size-9 items-center justify-center rounded-md text-[#d2e0dc] hover:bg-[#19483f] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="size-5"
                >
                  <path d="m6 6 12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
            <NavigationLinks
              items={navigationItems}
              pathname={pathname}
              onNavigate={closeMobileMenu}
            />
            <div className="mt-auto space-y-5 px-2 pt-8">
              <AccountDetails user={user} />
              <button
                type="button"
                onClick={handleLogout}
                disabled={logout.isPending}
                className="text-sm font-medium text-[#d2e0dc] hover:text-white focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-65"
              >
                {logout.isPending ? 'Signing out…' : 'Log out'}
              </button>
            </div>
          </div>
        </dialog>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {logoutError ? (
            <p className="mb-5 text-sm text-red-700" role="alert">
              {logoutError}
            </p>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}
