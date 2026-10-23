import { Suspense } from 'react';
import { AuthBoundary } from '@/components/layout/auth-boundary';
import { ReportDetailPage } from '@/components/reports/report-detail-page';

async function ReportRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AuthBoundary>
      <ReportDetailPage reportId={id} />
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
      <ReportRoute params={params} />
    </Suspense>
  );
}
