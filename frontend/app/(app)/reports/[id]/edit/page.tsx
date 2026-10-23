import { Suspense } from 'react';
import { AuthBoundary } from '@/components/layout/auth-boundary';
import { ReportEditPage } from '@/components/reports/report-edit-page';

async function EditReportRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <AuthBoundary>
      <ReportEditPage reportId={id} />
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
      <EditReportRoute params={params} />
    </Suspense>
  );
}
