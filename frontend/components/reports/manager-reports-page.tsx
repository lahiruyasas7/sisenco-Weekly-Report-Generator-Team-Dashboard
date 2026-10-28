'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ReportStatusBadge } from '@/components/reports/report-status-badge';
import { useManagerReports } from '@/lib/hooks/use-reports';
import type { ReportStatus } from '@/lib/types';

const PAGE_SIZE = 20;
const MANAGER_STATUSES = [
  'SUBMITTED',
  'NEEDS_CORRECTION',
  'APPROVED',
] as const satisfies readonly Exclude<ReportStatus, 'DRAFT'>[];
type ManagerStatusFilter = (typeof MANAGER_STATUSES)[number] | '';

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00Z`));
}

function submittedLabel(value: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function ManagerReportsPage() {
  const [page, setPage] = useState(1);
  const [weekStart, setWeekStart] = useState('');
  const [status, setStatus] = useState<ManagerStatusFilter>('');
  const reportsQuery = useManagerReports({
    page,
    limit: PAGE_SIZE,
    ...(weekStart ? { weekStart } : {}),
    ...(status ? { status } : {}),
  });
  const reports = reportsQuery.data?.data ?? [];
  const meta = reportsQuery.data?.meta;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Team reports</h1>
        <p className="mt-1 text-sm text-[#66716d]">
          Review submitted weekly reports and follow up on team progress.
        </p>
      </header>

      <section
        className="overflow-hidden rounded-xl border border-[#dedfdc] bg-white"
        aria-label="Team report list"
      >
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#eceeeb] px-5 py-4">
          <p className="text-sm font-medium text-[#38433e]">Reports</p>
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1 text-xs text-[#545f5b]">
              Week starting
              <input
                type="date"
                value={weekStart}
                onChange={(event) => {
                  setWeekStart(event.currentTarget.value);
                  setPage(1);
                }}
                className="h-9 rounded-md border border-[#c9ccc7] bg-white px-2 text-sm text-[#202623]"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-[#545f5b]">
              Status
              <select
                value={status}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setStatus(
                    MANAGER_STATUSES.find((item) => item === value) ?? '',
                  );
                  setPage(1);
                }}
                className="h-9 rounded-md border border-[#c9ccc7] bg-white px-2 text-sm text-[#202623]"
              >
                <option value="">All non-draft reports</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="NEEDS_CORRECTION">Needs correction</option>
                <option value="APPROVED">Approved</option>
              </select>
            </label>
          </div>
        </div>

        {reportsQuery.isError ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-red-700" role="alert">
              We couldn’t load team reports. Please try again.
            </p>
            <button
              type="button"
              onClick={() => void reportsQuery.refetch()}
              className="mt-3 text-sm font-medium text-[#08796f] underline underline-offset-2"
            >
              Try again
            </button>
          </div>
        ) : reportsQuery.isLoading ? (
          <p
            className="px-6 py-12 text-center text-sm text-[#66716d]"
            role="status"
          >
            Loading team reports…
          </p>
        ) : reports.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-[#38433e]">
              No reports match these filters.
            </p>
            <p className="mt-1 text-sm text-[#66716d]">
              Try a different week or status.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] border-collapse text-left text-sm">
                <thead className="text-xs text-[#58635f]">
                  <tr className="border-b border-[#dedfdc]">
                    <th scope="col" className="px-5 py-3 font-semibold">
                      Member
                    </th>
                    <th scope="col" className="px-3 py-3 font-semibold">
                      Week
                    </th>
                    <th scope="col" className="px-3 py-3 font-semibold">
                      Project
                    </th>
                    <th scope="col" className="px-3 py-3 font-semibold">
                      Status
                    </th>
                    <th scope="col" className="px-3 py-3 font-semibold">
                      Submitted
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
                  {reports.map((report) => (
                    <tr key={report.id}>
                      <td className="px-5 py-3 font-medium">
                        {report.user.name}
                      </td>
                      <td className="px-3 py-3">
                        {dateLabel(report.weekStart)} –{' '}
                        {dateLabel(report.weekEnd)}
                      </td>
                      <td className="px-3 py-3">
                        {report.project?.name ?? 'Not selected'}
                      </td>
                      <td className="px-3 py-3">
                        <ReportStatusBadge status={report.status} />
                      </td>
                      <td className="px-3 py-3 text-[#58635f]">
                        {submittedLabel(report.submittedAt)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Link
                          href={`/manager/reports/${encodeURIComponent(report.id)}/review`}
                          className="font-medium text-[#08796f] hover:underline"
                        >
                          Review
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
                  Page {meta.page} of {meta.totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={page <= 1 || reportsQuery.isFetching}
                    onClick={() => setPage((current) => current - 1)}
                    className="rounded-md border border-[#d7dcd8] px-3 py-2 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={
                      page >= meta.totalPages || reportsQuery.isFetching
                    }
                    onClick={() => setPage((current) => current + 1)}
                    className="rounded-md border border-[#d7dcd8] px-3 py-2 disabled:opacity-50"
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
