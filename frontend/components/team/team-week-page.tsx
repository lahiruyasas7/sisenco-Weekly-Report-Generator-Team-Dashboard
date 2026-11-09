'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { TeamStatusBadge } from '@/components/team/team-status-badge';
import { WeekPicker } from '@/components/team/week-picker';
import { useTeamWeekStatus } from '@/lib/hooks/use-team';
import type { TeamReportStatus, TeamWeekStatusResponse } from '@/lib/types';
import { getCurrentWeekStart } from '@/lib/week';

const STATUS_FILTERS: { value: 'ALL' | TeamReportStatus; label: string }[] = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'NOT_STARTED', label: 'Not started' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'NEEDS_CORRECTION', label: 'Needs correction' },
  { value: 'APPROVED', label: 'Approved' },
];
const SUMMARY_STATUSES: { value: TeamReportStatus; label: string }[] = [
  { value: 'NOT_STARTED', label: 'Not started' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'NEEDS_CORRECTION', label: 'Needs correction' },
  { value: 'APPROVED', label: 'Approved' },
];
const EMPTY_MEMBERS: TeamWeekStatusResponse['data'] = [];

export function TeamWeekPage() {
  const currentWeekStart = getCurrentWeekStart();
  const [weekStart, setWeekStart] = useState(currentWeekStart);
  const [statusFilter, setStatusFilter] = useState<'ALL' | TeamReportStatus>(
    'ALL',
  );
  const [search, setSearch] = useState('');
  const statusQuery = useTeamWeekStatus(weekStart);
  const members = statusQuery.data?.data ?? EMPTY_MEMBERS;
  const visibleMembers = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    return members.filter(
      (member) =>
        (statusFilter === 'ALL' || member.status === statusFilter) &&
        (!normalizedSearch ||
          member.user.name.toLocaleLowerCase().includes(normalizedSearch)),
    );
  }, [members, search, statusFilter]);
  const counts = useMemo(() => {
    const summary: Record<TeamReportStatus, number> = {
      NOT_STARTED: 0,
      DRAFT: 0,
      SUBMITTED: 0,
      NEEDS_CORRECTION: 0,
      APPROVED: 0,
    };
    for (const member of members) summary[member.status] += 1;
    return summary;
  }, [members]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team week</h1>
          <p className="mt-1 text-sm text-[#66716d]">
            Track weekly report progress across active members.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/manager/team/members"
            className="inline-flex h-10 items-center rounded-md border border-[#d7dcd8] bg-white px-3 text-sm font-medium text-[#38433e] hover:bg-[#f6f7f5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0c7c72]"
          >
            Member directory
          </Link>
          <WeekPicker
            weekStart={weekStart}
            currentWeekStart={currentWeekStart}
            onChange={setWeekStart}
          />
        </div>
      </header>

      {statusQuery.isError ? (
        <section className="rounded-xl border border-red-200 bg-white px-6 py-12 text-center">
          <p className="text-sm text-red-700" role="alert">
            We couldn’t load the team’s week status. Please try again.
          </p>
          <button
            type="button"
            onClick={() => void statusQuery.refetch()}
            className="mt-3 text-sm font-medium text-[#08796f] underline underline-offset-2"
          >
            Try again
          </button>
        </section>
      ) : statusQuery.isLoading ? (
        <p
          className="rounded-xl border border-[#dedfdc] bg-white px-6 py-12 text-center text-sm text-[#66716d]"
          role="status"
          aria-live="polite"
        >
          Loading team status…
        </p>
      ) : (
        <>
          <section
            aria-label="Report status summary"
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
          >
            {SUMMARY_STATUSES.map(({ value, label }) => (
              <button
                type="button"
                key={value}
                onClick={() =>
                  setStatusFilter((current) =>
                    current === value ? 'ALL' : value,
                  )
                }
                aria-pressed={statusFilter === value}
                className={`rounded-xl border bg-white p-4 text-left transition hover:border-[#9dbcb5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0c7c72] ${
                  statusFilter === value
                    ? 'border-[#0c7c72] ring-2 ring-[#0c7c72]/15'
                    : 'border-[#dedfdc]'
                }`}
              >
                <span className="block text-xs text-[#66716d]">{label}</span>
                <span className="mt-1 block text-2xl font-semibold">
                  {counts[value]}
                </span>
              </button>
            ))}
          </section>

          <section className="overflow-hidden rounded-xl border border-[#dedfdc] bg-white">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#eceeeb] px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold">Members</h2>
                <p className="mt-1 text-xs text-[#66716d]">
                  {members.length} eligible{' '}
                  {members.length === 1 ? 'member' : 'members'}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <label className="flex flex-col gap-1 text-xs text-[#545f5b]">
                  Search members
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.currentTarget.value)}
                    placeholder="Name"
                    className="h-9 w-48 rounded-md border border-[#c9ccc7] bg-white px-2 text-sm text-[#202623] outline-none focus:border-[#0c7c72] focus:ring-2 focus:ring-[#0c7c72]/15"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-[#545f5b]">
                  Status
                  <select
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(
                        STATUS_FILTERS.find(
                          ({ value }) => value === event.currentTarget.value,
                        )?.value ?? 'ALL',
                      )
                    }
                    className="h-9 rounded-md border border-[#c9ccc7] bg-white px-2 text-sm text-[#202623] outline-none focus:border-[#0c7c72] focus:ring-2 focus:ring-[#0c7c72]/15"
                  >
                    {STATUS_FILTERS.map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {visibleMembers.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-[#66716d]">
                {members.length === 0
                  ? 'No eligible members for this week.'
                  : 'No members match these filters.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse text-left text-sm">
                  <thead className="text-xs text-[#58635f]">
                    <tr className="border-b border-[#dedfdc]">
                      <th scope="col" className="px-5 py-3 font-semibold">
                        Member
                      </th>
                      <th scope="col" className="px-3 py-3 font-semibold">
                        Status
                      </th>
                      <th
                        scope="col"
                        className="px-5 py-3 text-right font-semibold"
                      >
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eceeeb]">
                    {visibleMembers.map((member) => (
                      <tr key={member.user.id}>
                        <td className="px-5 py-3">
                          <Link
                            href={`/manager/team/${encodeURIComponent(member.user.id)}`}
                            className="font-medium text-[#08796f] hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0c7c72]"
                          >
                            {member.user.name}
                          </Link>
                        </td>
                        <td className="px-3 py-3">
                          <TeamStatusBadge status={member.status} />
                          {member.status === 'DRAFT' ? (
                            <span className="sr-only">
                              {' '}
                              Draft content is only visible to its owner.
                            </span>
                          ) : null}
                        </td>
                        <td className="px-5 py-3 text-right">
                          {member.reportId ? (
                            <Link
                              href={`/manager/reports/${encodeURIComponent(member.reportId)}/review`}
                              className="font-medium text-[#08796f] hover:underline"
                            >
                              View report
                            </Link>
                          ) : (
                            <span className="text-xs text-[#87918d]">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
