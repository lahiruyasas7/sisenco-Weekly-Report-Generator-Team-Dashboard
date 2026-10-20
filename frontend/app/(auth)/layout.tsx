import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[#f6f7f5] font-sans text-[#202623] lg:grid lg:grid-cols-[53.125%_46.875%]">
      <section className="flex min-h-[220px] items-center bg-[#0d302c] px-6 py-10 text-white sm:px-12 lg:min-h-screen lg:px-16">
        <div className="max-w-md">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Weekly Reports
          </h1>
          <p className="mt-7 max-w-sm text-[15px] leading-[1.55] text-[#d4e0dc]">
            Submit your week, get it reviewed, and see how the whole team is
            doing.
          </p>
        </div>
      </section>
      <section className="flex items-center justify-center px-5 py-10 sm:px-10 lg:px-12 lg:py-12">
        <div className="w-full max-w-[418px] rounded-xl border border-[#dedfdc] bg-white px-7 py-7 sm:px-7 sm:py-8">
          {children}
        </div>
      </section>
    </main>
  );
}
