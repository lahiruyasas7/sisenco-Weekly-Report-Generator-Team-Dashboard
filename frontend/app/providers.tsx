'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { API_UNAUTHORIZED_EVENT } from '@/lib/api-client';

type ProvidersProps = {
  children: ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  const router = useRouter();
  const [queryClient] = useState(() => new QueryClient());

  useEffect(() => {
    function handleUnauthorized() {
      queryClient.clear();
      router.replace('/login');
    }

    window.addEventListener(API_UNAUTHORIZED_EVENT, handleUnauthorized);
    return () =>
      window.removeEventListener(API_UNAUTHORIZED_EVENT, handleUnauthorized);
  }, [queryClient, router]);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
