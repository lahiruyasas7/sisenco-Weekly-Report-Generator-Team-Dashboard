'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { getAuthRedirect } from '@/lib/auth-routing';
import { useCurrentUser } from '@/lib/hooks/use-auth';
import { ProtectedAppShell } from '@/components/layout/protected-app-shell';

export function AuthBoundary({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const currentUser = useCurrentUser();
  const redirectTo = currentUser.data
    ? getAuthRedirect(currentUser.data, pathname)
    : null;

  useEffect(() => {
    if (redirectTo) {
      router.replace(redirectTo);
    }
  }, [redirectTo, router]);

  if (currentUser.isError && !currentUser.data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f7f5] px-5 font-sans text-sm text-[#66716d]">
        <div className="text-center">
          <p role="alert">We couldn’t verify your account. Please try again.</p>
          <button
            type="button"
            className="mt-3 font-medium text-[#08796f] underline underline-offset-2 disabled:opacity-60"
            disabled={currentUser.isFetching}
            onClick={() => void currentUser.refetch()}
          >
            {currentUser.isFetching ? 'Checking…' : 'Try again'}
          </button>
        </div>
      </main>
    );
  }

  if (currentUser.isLoading || !currentUser.data) {
    return (
      <main
        className="flex min-h-screen items-center justify-center bg-[#f6f7f5] px-5 font-sans text-sm text-[#66716d]"
        role="status"
        aria-live="polite"
      >
        Checking your account…
      </main>
    );
  }

  if (redirectTo) {
    return (
      <main
        className="flex min-h-screen items-center justify-center bg-[#f6f7f5] px-5 font-sans text-sm text-[#66716d]"
        role="status"
        aria-live="polite"
      >
        Redirecting…
      </main>
    );
  }

  return (
    <ProtectedAppShell user={currentUser.data}>{children}</ProtectedAppShell>
  );
}
