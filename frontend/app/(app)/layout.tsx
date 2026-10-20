import type { ReactNode } from 'react';
import { AuthBoundary } from '@/components/layout/auth-boundary';

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return <AuthBoundary>{children}</AuthBoundary>;
}
