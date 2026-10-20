'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { AuthField, authInputClassName } from '@/components/auth/auth-field';
import { AuthTabs } from '@/components/auth/auth-tabs';
import { ApiError } from '@/lib/api-client';
import { useLogin } from '@/lib/hooks/use-auth';
import { loginSchema } from '@/lib/validators/auth';
import type { z } from 'zod';

type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useLogin();
  const notice =
    searchParams.get('registered') === '1'
      ? 'Account created. Sign in with your new account.'
      : searchParams.get('passwordChanged') === '1'
        ? 'Password changed. Sign in with your new password.'
        : undefined;
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });
  const serverError = form.formState.errors.root?.server?.message;

  async function onSubmit(values: LoginValues) {
    form.clearErrors('root.server');
    try {
      const user = await login.mutateAsync(values);
      router.replace(user.mustChangePassword ? '/change-password' : '/');
    } catch (error) {
      const message =
        error instanceof ApiError && error.statusCode === 401
          ? 'Invalid email or password.'
          : error instanceof Error
            ? error.message
            : 'Unable to sign in. Please try again.';
      form.setError('root.server', { type: 'server', message });
    }
  }

  return (
    <>
      <AuthTabs active="login" />
      <form
        className="mt-5 space-y-3.5"
        noValidate
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <AuthField
          id="email"
          label="Email"
          error={form.formState.errors.email?.message}
        >
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="name@company.com"
            aria-invalid={Boolean(form.formState.errors.email)}
            aria-describedby={
              form.formState.errors.email ? 'email-error' : undefined
            }
            className={authInputClassName}
            {...form.register('email')}
          />
        </AuthField>
        <AuthField
          id="password"
          label="Password"
          error={form.formState.errors.password?.message}
        >
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={Boolean(form.formState.errors.password)}
            aria-describedby={
              form.formState.errors.password ? 'password-error' : undefined
            }
            className={authInputClassName}
            {...form.register('password')}
          />
        </AuthField>
        {notice ? (
          <p role="status" className="text-xs text-[#08796f]">
            {notice}
          </p>
        ) : null}
        {serverError ? (
          <p role="alert" className="text-xs text-red-700">
            {serverError}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={login.isPending}
          className="h-9 w-full rounded-md bg-[#0c7c72] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#096b62] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0c7c72] disabled:cursor-not-allowed disabled:opacity-65"
        >
          {login.isPending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="mt-4 text-[13px] leading-[1.5] text-[#66716d]">
        New here? Creating an account gives you a Team Member role. Admins can
        change it later.
      </p>
    </>
  );
}
