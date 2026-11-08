import { AuthBoundary } from '@/components/layout/auth-boundary';
import { TeamWeekPage } from '@/components/team/team-week-page';

export default function Page() {
  return (
    <AuthBoundary>
      <TeamWeekPage />
    </AuthBoundary>
  );
}
