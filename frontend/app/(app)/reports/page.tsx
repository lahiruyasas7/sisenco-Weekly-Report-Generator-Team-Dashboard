import { AuthBoundary } from '@/components/layout/auth-boundary';
import { ReportsPage } from '@/components/reports/reports-page';

export default function Page() {
  return (
    <AuthBoundary>
      <ReportsPage />
    </AuthBoundary>
  );
}
