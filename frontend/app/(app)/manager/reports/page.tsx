import { AuthBoundary } from '@/components/layout/auth-boundary';
import { ManagerReportsPage } from '@/components/reports/manager-reports-page';

export default function Page() {
  return (
    <AuthBoundary>
      <ManagerReportsPage />
    </AuthBoundary>
  );
}
