import { AuthBoundary } from '@/components/layout/auth-boundary';
import { NewReportPage } from '@/components/reports/new-report-page';

export default function Page() {
  return (
    <AuthBoundary>
      <NewReportPage />
    </AuthBoundary>
  );
}
