import { AuthBoundary } from '@/components/layout/auth-boundary';

export default function HomePage() {
  return (
    <AuthBoundary>
      <section className="rounded-xl border border-[#dedfdc] bg-white p-7 sm:p-9">
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome to Weekly Reports
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#66716d]">
          Your team workspace is ready. Report and dashboard pages will appear
          here as they are added.
        </p>
      </section>
    </AuthBoundary>
  );
}
