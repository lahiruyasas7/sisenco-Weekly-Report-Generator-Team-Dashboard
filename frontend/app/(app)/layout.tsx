import type { ReactNode } from 'react';

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  // Keep the route tree mounted so Next can validate each page segment.
  return children;
}
