import { AdminUsersPage } from '@/components/admin/admin-users-page';
import { AuthBoundary } from '@/components/layout/auth-boundary';

export default function AdminUsersRoute() {
  return (
    <AuthBoundary>
      <AdminUsersPage />
    </AuthBoundary>
  );
}
