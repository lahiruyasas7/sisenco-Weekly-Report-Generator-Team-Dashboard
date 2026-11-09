'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useTeamMembers } from '@/lib/hooks/use-users';
import type { ReportStatus } from '@/lib/types';

const PAGE_SIZE = 20;
const REPORT_STATUSES: { status: ReportStatus; label: string }[] = [
  { status: 'SUBMITTED', label: 'Submitted' },
  { status: 'APPROVED', label: 'Approved' },
  { status: 'NEEDS_CORRECTION', label: 'Needs correction' },
  { status: 'DRAFT', label: 'Drafts' },
];

export function TeamMembersPage() {
  const [page, setPage] = useState(1);
  const membersQuery = useTeamMembers(page, PAGE_SIZE);
  const members = membersQuery.data?.data ?? [];
  const meta = membersQuery.data?.meta;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Team members
          </h1>
          <p className="mt-1 text-sm text-[#66716d]">
            Browse active members and their report history at a glance.
          </p>
        </div>
        <Link
          href="/manager/team"
          className="inline-flex h-9 items-center rounded-md border border-[#d7dcd8] px-3 text-sm font-medium text-[#38433e] hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0c7c72]"
        >
          Team week
        </Link>
      </header>

      <section className="overflow-hidden rounded-xl border border-[#dedfdc] bg-white">
        {membersQuery.isError ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-red-700" role="alert">
              We couldn’t load team members. Please try again.
            </p>
            <button
              type="button"
              onClick={() => void membersQuery.refetch()}
              className="mt-3 text-sm font-medium text-[#08796f] underline underline-offset-2"
            >
              Try again
            </button>
          </div>
        ) : membersQuery.isLoading ? (
          <p
            className="px-6 py-12 text-center text-sm text-[#66716d]"
            role="status"
            aria-live="polite"
          >
            Loading team members…
          </p>
        ) : members.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-[#66716d]">
            No active members found.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse text-left text-sm">
                <thead className="text-xs text-[#58635f]">
                  <tr className="border-b border-[#dedfdc]">
                    <th scope="col" className="px-5 py-3 font-semibold">
                      Member
                    </th>
                    {REPORT_STATUSES.map(({ status, label }) => (
                      <th
                        key={status}
                        scope="col"
                        className="px-3 py-3 text-right font-semibold"
                      >
                        {label}
                      </th>
                    ))}
                    <th scope="col" className="px-5 py-3 text-right">
                      <span className="sr-only">Action</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eceeeb]">
                  {members.map((member) => (
                    <tr key={member.id}>
                      <td className="px-5 py-3 font-medium">
                        <Link
                          href={`/manager/team/${encodeURIComponent(member.id)}`}
                          className="text-[#08796f] hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0c7c72]"
                        >
                          {member.name}
                        </Link>
                      </td>
                      {REPORT_STATUSES.map(({ status }) => (
                        <td
                          key={status}
                          className="px-3 py-3 text-right tabular-nums text-[#38433e]"
                        >
                          {member.reportsByStatus[status]}
                        </td>
                      ))}
                      <td className="px-5 py-3 text-right">
                        <Link
                          href={`/manager/team/${encodeURIComponent(member.id)}`}
                          className="font-medium text-[#08796f] hover:underline"
                        >
                          Profile
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {meta && meta.totalPages > 1 ? (
              <footer className="flex items-center justify-between border-t border-[#eceeeb] px-5 py-3 text-sm">
                <span className="text-xs text-[#66716d]">
                  Page {meta.page} of {meta.totalPages} · {meta.total} members
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={page <= 1 || membersQuery.isFetching}
                    onClick={() => setPage((current) => current - 1)}
                    className="rounded-md border border-[#d7dcd8] px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={
                      page >= meta.totalPages || membersQuery.isFetching
                    }
                    onClick={() => setPage((current) => current + 1)}
                    className="rounded-md border border-[#d7dcd8] px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </footer>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
