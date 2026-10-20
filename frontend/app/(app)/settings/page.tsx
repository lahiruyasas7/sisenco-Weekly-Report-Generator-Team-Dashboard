'use client';

import { PasswordSettingsForm } from '@/components/settings/password-settings-form';
import { ProfileSettingsForm } from '@/components/settings/profile-settings-form';
import { AuthBoundary } from '@/components/layout/auth-boundary';
import { useCurrentUser } from '@/lib/hooks/use-auth';

export default function SettingsPage() {
  return (
    <AuthBoundary>
      <SettingsContent />
    </AuthBoundary>
  );
}

function SettingsContent() {
  const currentUser = useCurrentUser();

  if (currentUser.isError && !currentUser.data) {
    return (
      <section className="rounded-xl border border-[#dedfdc] bg-white p-6">
        <p role="alert" className="text-sm text-red-700">
          We couldn’t load your settings. Please try again.
        </p>
        <button
          type="button"
          className="mt-3 text-sm font-medium text-[#08796f] underline underline-offset-2"
          onClick={() => void currentUser.refetch()}
        >
          Try again
        </button>
      </section>
    );
  }

  if (currentUser.isLoading || !currentUser.data) {
    return (
      <p role="status" className="py-10 text-center text-sm text-[#66716d]">
        Loading your settings…
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-[#66716d]">
          Manage your account name and password.
        </p>
      </header>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-xl border border-[#dedfdc] bg-white p-6 sm:p-7">
          <h2 className="text-base font-semibold">Profile</h2>
          <p className="mb-5 mt-1 text-sm text-[#66716d]">
            Update the name shown in Weekly Reports.
          </p>
          <ProfileSettingsForm
            key={`${currentUser.data.id}:${currentUser.data.name}`}
            user={currentUser.data}
          />
        </section>
        <section className="rounded-xl border border-[#dedfdc] bg-white p-6 sm:p-7">
          <h2 className="text-base font-semibold">Password</h2>
          <p className="mb-5 mt-1 text-sm text-[#66716d]">
            Choose a new password for your account.
          </p>
          <PasswordSettingsForm />
        </section>
      </div>
    </div>
  );
}
