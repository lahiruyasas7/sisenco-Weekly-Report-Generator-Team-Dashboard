import { Suspense } from 'react';
import { AuthBoundary } from '@/components/layout/auth-boundary';
import { TeamMemberProfilePage } from '@/components/team/team-member-profile-page';

async function TeamMemberRoute({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  return (
    <AuthBoundary>
      <TeamMemberProfilePage userId={userId} />
    </AuthBoundary>
  );
}

export default function Page({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  return (
    <Suspense
      fallback={
        <p className="py-12 text-center text-sm text-[#66716d]">
          Loading member profile…
        </p>
      }
    >
      <TeamMemberRoute params={params} />
    </Suspense>
  );
}
