'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ReportView } from '@/components/reports/report-view';
import { useCurrentUser } from '@/lib/hooks/use-auth';
import { useDeleteReport, useReport } from '@/lib/hooks/use-reports';

export function ReportDetailPage({ reportId }: { reportId: string }) {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const reportQuery = useReport(reportId);
  const deleteReport = useDeleteReport();
  const [actionError, setActionError] = useState('');
  const report = reportQuery.data;
  const canEdit =
    currentUser.data?.role === 'MEMBER' &&
    (report?.status === 'DRAFT' || report?.status === 'NEEDS_CORRECTION');

  async function removeDraft() {
    if (
      !report ||
      !window.confirm('Delete this draft report? This cannot be undone.')
    )
      return;
    setActionError('');
    try {
      await deleteReport.mutateAsync(report.id);
      router.replace('/reports');
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Unable to delete the draft.',
      );
    }
  }

  if (reportQuery.isLoading) {
    return (
      <p className="py-12 text-center text-sm text-[#66716d]" role="status">
        Loading report…
      </p>
    );
  }
  if (reportQuery.isError || !report) {
    return (
      <div className="rounded-xl border border-[#dedfdc] bg-white px-6 py-12 text-center">
        <p className="text-sm text-red-700" role="alert">
          We couldn’t load this report.
        </p>
        <button
          type="button"
          onClick={() => void reportQuery.refetch()}
          className="mt-3 text-sm font-medium text-[#08796f] underline"
        >
          Try again
        </button>
        <Link
          href="/reports"
          className="ml-4 text-sm font-medium text-[#08796f] underline"
        >
          Back to reports
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {actionError ? (
        <p
          className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700"
          role="alert"
        >
          {actionError}
        </p>
      ) : null}
      {canEdit ? (
        <div className="flex justify-end gap-2">
          {report.status === 'DRAFT' ? (
            <button
              type="button"
              disabled={deleteReport.isPending}
              onClick={() => void removeDraft()}
              className="h-9 rounded-md border border-red-200 px-4 text-sm font-medium text-red-700 disabled:opacity-60"
            >
              {deleteReport.isPending ? 'Deleting…' : 'Delete draft'}
            </button>
          ) : null}
          <Link
            href={`/reports/${encodeURIComponent(report.id)}/edit`}
            className="inline-flex h-9 items-center rounded-md bg-[#0c7c72] px-4 text-sm font-semibold text-white"
          >
            {report.status === 'DRAFT' ? 'Continue draft' : 'Edit and resubmit'}
          </Link>
        </div>
      ) : null}
      <ReportView report={report} />
    </div>
  );
}
