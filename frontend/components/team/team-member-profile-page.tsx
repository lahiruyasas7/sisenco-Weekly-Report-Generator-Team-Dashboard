'use client';

import Link from 'next/link';
import { useTeamMemberProfile } from '@/lib/hooks/use-users';
import type { ReportStatus } from '@/lib/types';

const REPORT_STATUSES: { status: ReportStatus; label: string }[] = [
  { status: 'DRAFT', label: 'Drafts' },
  { status: 'SUBMITTED', label: 'Submitted' },
  { status: 'NEEDS_CORRECTION', label: 'Needs correction' },
  { status: 'APPROVED', label: 'Approved' },
];

function createdAtLabel(value: string): string {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(value));
}

export function TeamMemberProfilePage({ userId }: { userId: string }) {
  const profileQuery = useTeamMemberProfile(userId);
  const profile = profileQuery.data;

  return (
    <div className="space-y-6">
      <Link
        href="/manager/team"
        className="inline-flex text-sm font-medium text-[#08796f] hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0c7c72]"
      >
        ← Back to team week
      </Link>

      {profileQuery.isError ? (
        <section className="rounded-xl border border-red-200 bg-white px-6 py-12 text-center">
          <p className="text-sm text-red-700" role="alert">
            We couldn’t load this member’s profile. They may no longer be
            available.
          </p>
          <button
            type="button"
            onClick={() => void profileQuery.refetch()}
            className="mt-3 text-sm font-medium text-[#08796f] underline underline-offset-2"
          >
            Try again
          </button>
        </section>
      ) : profileQuery.isLoading || !profile ? (
        <p
          className="rounded-xl border border-[#dedfdc] bg-white px-6 py-12 text-center text-sm text-[#66716d]"
          role="status"
          aria-live="polite"
        >
          Loading member profile…
        </p>
      ) : (
        <>
          <header className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-[#dedfdc] bg-white p-5 sm:p-6">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                {profile.user.name}
              </h1>
              <p className="mt-1 text-sm text-[#66716d]">
                Member since {createdAtLabel(profile.user.createdAt)}
              </p>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                profile.user.isActive
                  ? 'bg-[#d4f1e6] text-[#17654e]'
                  : 'bg-[#eef0ee] text-[#48534e]'
              }`}
            >
              {profile.user.isActive ? 'Active' : 'Inactive'}
            </span>
          </header>

          <section
            aria-label="Member report statistics"
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
          >
            <article className="rounded-xl border border-[#dedfdc] bg-white p-4">
              <p className="text-xs text-[#66716d]">On-time submission rate</p>
              <p className="mt-1 text-2xl font-semibold">
                {profile.stats.onTimeRate === null
                  ? '—'
                  : `${Math.round(profile.stats.onTimeRate * 100)}%`}
              </p>
              <p className="mt-1 text-xs text-[#66716d]">
                Of submitted reports
              </p>
            </article>
            <article className="rounded-xl border border-[#dedfdc] bg-white p-4">
              <p className="text-xs text-[#66716d]">Average weekly hours</p>
              <p className="mt-1 text-2xl font-semibold">
                {profile.stats.averageWeeklySpentHours.toFixed(2)}
                <span className="ml-1 text-sm font-normal text-[#66716d]">
                  hrs
                </span>
              </p>
              <p className="mt-1 text-xs text-[#66716d]">
                Submitted and approved reports
              </p>
            </article>
            <article className="rounded-xl border border-[#dedfdc] bg-white p-4 sm:col-span-2 xl:col-span-1">
              <p className="text-xs text-[#66716d]">Total reports</p>
              <p className="mt-1 text-2xl font-semibold">
                {Object.values(profile.stats.reportsByStatus).reduce(
                  (total, count) => total + count,
                  0,
                )}
              </p>
              <p className="mt-1 text-xs text-[#66716d]">All time</p>
            </article>
          </section>

          <section className="rounded-xl border border-[#dedfdc] bg-white p-5 sm:p-6">
            <h2 className="text-base font-semibold">Reports by status</h2>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {REPORT_STATUSES.map(({ status, label }) => (
                <div key={status} className="rounded-lg bg-[#f6f7f5] px-4 py-3">
                  <dt className="text-xs text-[#66716d]">{label}</dt>
                  <dd className="mt-1 text-xl font-semibold">
                    {profile.stats.reportsByStatus[status]}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </>
      )}
    </div>
  );
}
