import { Suspense } from 'react';
import { connection } from 'next/server';
import { AuthBoundary } from '@/components/layout/auth-boundary';
import { DashboardPage } from '@/components/dashboard/dashboard-page';
import { getCurrentWeekStart } from '@/lib/week';

async function DashboardContent() {
  await connection();

  return <DashboardPage initialWeekStart={getCurrentWeekStart()} />;
}

export default function HomePage() {
  return (
    <AuthBoundary>
      <Suspense
        fallback={
          <p className="py-12 text-center text-sm text-[#66716d]" role="status">
            Preparing your dashboard…
          </p>
        }
      >
        <DashboardContent />
      </Suspense>
    </AuthBoundary>
  );
}
