import { AuthBoundary } from '@/components/layout/auth-boundary';
import { ProjectsPage } from '@/components/projects/projects-page';

export default function ProjectsRoute() {
  return (
    <AuthBoundary>
      <ProjectsPage />
    </AuthBoundary>
  );
}
