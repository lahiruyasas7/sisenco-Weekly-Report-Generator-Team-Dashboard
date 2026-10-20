import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginForm } from '@/components/auth/login-form';

export const metadata: Metadata = {
  title: 'Sign in | Weekly Reports',
};

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-36" role="status" />}>
      <LoginForm />
    </Suspense>
  );
}
