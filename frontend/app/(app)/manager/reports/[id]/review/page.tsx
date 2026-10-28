import { Suspense } from 'react';
import { AuthBoundary } from '@/components/layout/auth-boundary';
import { ManagerReportReviewPage } from '@/components/reports/manager-report-review-page';

async function ManagerReportRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <AuthBoundary>
      <ManagerReportReviewPage reportId={id} />
    </AuthBoundary>
  );
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense
      fallback={
        <p className="py-12 text-center text-sm text-[#66716d]">
          Loading report…
        </p>
      }
    >
      <ManagerReportRoute params={params} />
    </Suspense>
  );
}
