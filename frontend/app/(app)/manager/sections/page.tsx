import { AuthBoundary } from '@/components/layout/auth-boundary';
import { TeamSectionsPage } from '@/components/team/team-sections-page';

export default function Page() {
  return (
    <AuthBoundary>
      <TeamSectionsPage />
    </AuthBoundary>
  );
}
