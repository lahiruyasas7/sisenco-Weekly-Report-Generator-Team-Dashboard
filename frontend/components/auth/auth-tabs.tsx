import Link from 'next/link';

type AuthTabsProps = {
  active: 'login' | 'register';
};

export function AuthTabs({ active }: AuthTabsProps) {
  return (
    <nav aria-label="Account" className="flex border-b border-[#dedfdc]">
      <Link
        href="/login"
        aria-current={active === 'login' ? 'page' : undefined}
        className={`-mb-px border-b-2 px-1 py-2.5 text-[13px] transition-colors ${
          active === 'login'
            ? 'border-[#0c7c72] font-medium text-[#08796f]'
            : 'border-transparent text-[#545f5b] hover:text-[#202623]'
        }`}
      >
        Sign in
      </Link>
      <Link
        href="/register"
        aria-current={active === 'register' ? 'page' : undefined}
        className={`-mb-px ml-4 border-b-2 px-1 py-2.5 text-[13px] transition-colors ${
          active === 'register'
            ? 'border-[#0c7c72] font-medium text-[#08796f]'
            : 'border-transparent text-[#545f5b] hover:text-[#202623]'
        }`}
      >
        Create account
      </Link>
    </nav>
  );
}
