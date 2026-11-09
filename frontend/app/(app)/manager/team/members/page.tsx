import { AuthBoundary } from '@/components/layout/auth-boundary';
import { TeamMembersPage } from '@/components/team/team-members-page';

export default function Page() {
  return (
    <AuthBoundary>
      <TeamMembersPage />
    </AuthBoundary>
  );
}
