'use client';

import Link from 'next/link';
import { ReportEditor } from '@/components/reports/report-editor';
import { useReport } from '@/lib/hooks/use-reports';

export function ReportEditPage({ reportId }: { reportId: string }) {
  const reportQuery = useReport(reportId);
  if (reportQuery.isLoading) {
    return (
      <p className="py-12 text-center text-sm text-[#66716d]" role="status">
        Loading report…
      </p>
    );
  }
  if (reportQuery.isError || !reportQuery.data) {
    return (
      <div className="rounded-xl border border-[#dedfdc] bg-white px-6 py-12 text-center">
        <p className="text-sm text-red-700" role="alert">
          We couldn’t load this report for editing.
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
  return <ReportEditor report={reportQuery.data} />;
}
