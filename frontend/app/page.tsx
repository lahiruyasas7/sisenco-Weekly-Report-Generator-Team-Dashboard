'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useCurrentUser, useLogout } from '@/lib/hooks/use-auth';

export default function HomePage() {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const logout = useLogout();
  const [logoutError, setLogoutError] = useState('');

  useEffect(() => {
    if (currentUser.data?.mustChangePassword) {
      router.replace('/change-password');
    }
  }, [currentUser.data, router]);

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

  if (currentUser.isError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f7f5] px-5 font-sans text-sm text-[#66716d]">
        <div className="text-center">
          <p role="alert">We couldn’t load your account. Please try again.</p>
          <button
            type="button"
            className="mt-3 font-medium text-[#08796f] underline underline-offset-2"
            onClick={() => void currentUser.refetch()}
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  if (currentUser.isLoading || !currentUser.data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f7f5] px-5 font-sans text-sm text-[#66716d]">
        <p role="status">Loading your account…</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f7f5] px-5 py-10 font-sans text-[#202623]">
      <section className="w-full max-w-lg rounded-xl border border-[#dedfdc] bg-white p-7 sm:p-9">
        <p className="text-sm font-semibold text-[#08796f]">Weekly Reports</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          Welcome, {currentUser.data.name}
        </h1>
        <p className="mt-2 text-sm text-[#66716d]">
          You’re signed in as {currentUser.data.role.toLowerCase()}.
        </p>
        {logoutError ? (
          <p role="alert" className="mt-4 text-sm text-red-700">
            {logoutError}
          </p>
        ) : null}
        <button
          type="button"
          onClick={handleLogout}
          disabled={logout.isPending}
          className="mt-7 h-10 rounded-md bg-[#0c7c72] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#096b62] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0c7c72] disabled:cursor-not-allowed disabled:opacity-65"
        >
          {logout.isPending ? 'Signing out…' : 'Sign out'}
        </button>
      </section>
    </main>
  );
}
