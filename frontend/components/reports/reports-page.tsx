'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ReportStatusBadge } from '@/components/reports/report-status-badge';
import { useMyReports } from '@/lib/hooks/use-reports';
import type { ReportStatus } from '@/lib/types';

const PAGE_SIZE = 20;

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00Z`));
}

export function ReportsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<ReportStatus | ''>('');
  const reportsQuery = useMyReports({
    page,
    limit: PAGE_SIZE,
    ...(status ? { status } : {}),
  });
  const reports = reportsQuery.data?.data ?? [];
  const meta = reportsQuery.data?.meta;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            My weekly reports
          </h1>
          <p className="mt-1 text-sm text-[#66716d]">
            Your reports, organized by week and review status.
          </p>
        </div>
        <Link
          href="/reports/new"
          className="inline-flex h-9 items-center rounded-md bg-[#0c7c72] px-4 text-sm font-semibold text-white hover:bg-[#096b62] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0c7c72]"
        >
          New weekly report
        </Link>
      </header>

      <section
        className="overflow-hidden rounded-xl border border-[#dedfdc] bg-white"
        aria-label="Report history"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eceeeb] px-5 py-3">
          <p className="text-sm font-medium text-[#38433e]">Report history</p>
          <label className="flex items-center gap-2 text-xs text-[#545f5b]">
            Status
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.currentTarget.value as ReportStatus | '');
                setPage(1);
              }}
              className="h-9 rounded-md border border-[#c9ccc7] bg-white px-2 text-sm"
            >
              <option value="">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="NEEDS_CORRECTION">Needs correction</option>
              <option value="APPROVED">Approved</option>
            </select>
          </label>
        </div>

        {reportsQuery.isError ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-red-700" role="alert">
              We couldn’t load your reports. Please try again.
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
            Loading reports…
          </p>
        ) : reports.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-[#38433e]">
              {status
                ? 'No reports match this status.'
                : 'No weekly reports yet.'}
            </p>
            <p className="mt-1 text-sm text-[#66716d]">
              Create a draft to get started.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] border-collapse text-left text-sm">
                <thead className="text-xs text-[#58635f]">
                  <tr className="border-b border-[#dedfdc]">
                    <th scope="col" className="px-5 py-3 font-semibold">
                      Week
                    </th>
                    <th scope="col" className="px-3 py-3 font-semibold">
                      Project
                    </th>
                    <th scope="col" className="px-3 py-3 font-semibold">
                      Status
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-3 text-right font-semibold"
                    >
                      Report
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eceeeb]">
                  {reports.map((report) => (
                    <tr key={report.id}>
                      <td className="px-5 py-3 font-medium">
                        {dateLabel(report.weekStart)} –{' '}
                        {dateLabel(report.weekEnd)}
                      </td>
                      <td className="px-3 py-3 text-[#38433e]">
                        {report.project?.name ?? 'Not selected'}
                      </td>
                      <td className="px-3 py-3">
                        <ReportStatusBadge status={report.status} />
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Link
                          href={`/reports/${encodeURIComponent(report.id)}`}
                          className="font-medium text-[#08796f] hover:underline"
                        >
                          Open report
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
