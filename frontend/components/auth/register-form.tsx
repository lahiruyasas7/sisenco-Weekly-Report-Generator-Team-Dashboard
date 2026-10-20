'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { AuthField, authInputClassName } from '@/components/auth/auth-field';
import { AuthTabs } from '@/components/auth/auth-tabs';
import { ApiError } from '@/lib/api-client';
import { useRegister } from '@/lib/hooks/use-auth';
import { registerSchema } from '@/lib/validators/auth';
import type { z } from 'zod';

type RegisterValues = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const router = useRouter();
  const register = useRegister();
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  });
  const serverError = form.formState.errors.root?.server?.message;

  async function onSubmit(values: RegisterValues) {
    form.clearErrors('root.server');
    const input = {
      name: values.name,
      email: values.email,
      password: values.password,
    };
    try {
      await register.mutateAsync(input);
      router.replace('/login?registered=1');
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Unable to create your account. Please try again.';
      form.setError('root.server', { type: 'server', message });
    }
  }

  return (
    <>
      <AuthTabs active="register" />
      <form
        className="mt-5 space-y-3.5"
        noValidate
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <AuthField
          id="name"
          label="Name"
          error={form.formState.errors.name?.message}
        >
          <input
            id="name"
            type="text"
            autoComplete="name"
            aria-invalid={Boolean(form.formState.errors.name)}
            aria-describedby={
              form.formState.errors.name ? 'name-error' : undefined
            }
            className={authInputClassName}
            {...form.register('name')}
          />
        </AuthField>
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
            autoComplete="new-password"
            aria-invalid={Boolean(form.formState.errors.password)}
            aria-describedby={
              form.formState.errors.password ? 'password-error' : undefined
            }
            className={authInputClassName}
            {...form.register('password')}
          />
        </AuthField>
        <AuthField
          id="confirmPassword"
          label="Confirm password"
          error={form.formState.errors.confirmPassword?.message}
        >
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(form.formState.errors.confirmPassword)}
            aria-describedby={
              form.formState.errors.confirmPassword
                ? 'confirmPassword-error'
                : undefined
            }
            className={authInputClassName}
            {...form.register('confirmPassword')}
          />
        </AuthField>
        {serverError ? (
          <p role="alert" className="text-xs text-red-700">
            {serverError}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={register.isPending}
          className="h-9 w-full rounded-md bg-[#0c7c72] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#096b62] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0c7c72] disabled:cursor-not-allowed disabled:opacity-65"
        >
          {register.isPending ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="mt-4 text-[13px] leading-[1.5] text-[#66716d]">
        Your account will have the Team Member role. An administrator can change
        it later.
      </p>
    </>
  );
}
