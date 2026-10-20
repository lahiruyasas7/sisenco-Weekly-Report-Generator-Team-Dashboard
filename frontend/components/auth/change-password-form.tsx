'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { AuthField, authInputClassName } from '@/components/auth/auth-field';
import { ApiError } from '@/lib/api-client';
import { useChangePassword, useCurrentUser } from '@/lib/hooks/use-auth';
import { changePasswordSchema } from '@/lib/validators/auth';
import type { z } from 'zod';

type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

export function ChangePasswordForm() {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const changePassword = useChangePassword();
  const form = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });
  const serverError = form.formState.errors.root?.server?.message;

  useEffect(() => {
    if (currentUser.data && !currentUser.data.mustChangePassword) {
      router.replace('/');
    }
  }, [currentUser.data, router]);

  async function onSubmit(values: ChangePasswordValues) {
    form.clearErrors('root.server');
    const input = {
      currentPassword: values.currentPassword,
      newPassword: values.newPassword,
    };
    try {
      await changePassword.mutateAsync(input);
      router.replace('/login?passwordChanged=1');
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.statusCode === 401 &&
        error.message.toLowerCase() === 'unauthorized'
      ) {
        router.replace('/login');
        return;
      }

      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Unable to change your password. Please try again.';
      form.setError('root.server', { type: 'server', message });
    }
  }

  if (currentUser.isLoading) {
    return (
      <div className="py-6 text-center text-sm text-[#66716d]" role="status">
        Checking your account…
      </div>
    );
  }

  if (currentUser.isError) {
    return (
      <div className="py-6 text-center">
        <p className="text-sm text-red-700" role="alert">
          We couldn’t verify your account. Please try again.
        </p>
        <button
          type="button"
          className="mt-3 text-sm font-medium text-[#08796f] underline underline-offset-2"
          onClick={() => void currentUser.refetch()}
        >
          Try again
        </button>
      </div>
    );
  }

  if (!currentUser.data?.mustChangePassword) {
    return (
      <div className="py-6 text-center text-sm text-[#66716d]" role="status">
        Redirecting to your account…
      </div>
    );
  }

  return (
    <>
      <h2 className="text-base font-semibold text-[#202623]">
        Change your password
      </h2>
      <p className="mt-2 text-[13px] leading-[1.5] text-[#66716d]">
        Your administrator gave you a temporary password. Set a new one to
        continue.
      </p>
      <form
        className="mt-5 space-y-3.5"
        noValidate
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <AuthField
          id="currentPassword"
          label="Current password"
          error={form.formState.errors.currentPassword?.message}
        >
          <input
            id="currentPassword"
            type="password"
            autoComplete="current-password"
            aria-invalid={Boolean(form.formState.errors.currentPassword)}
            aria-describedby={
              form.formState.errors.currentPassword
                ? 'currentPassword-error'
                : undefined
            }
            className={authInputClassName}
            {...form.register('currentPassword')}
          />
        </AuthField>
        <AuthField
          id="newPassword"
          label="New password"
          error={form.formState.errors.newPassword?.message}
        >
          <input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(form.formState.errors.newPassword)}
            aria-describedby={
              form.formState.errors.newPassword
                ? 'newPassword-error'
                : undefined
            }
            className={authInputClassName}
            {...form.register('newPassword')}
          />
        </AuthField>
        <AuthField
          id="confirmPassword"
          label="Confirm new password"
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
          disabled={changePassword.isPending}
          className="h-9 w-full rounded-md bg-[#0c7c72] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#096b62] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0c7c72] disabled:cursor-not-allowed disabled:opacity-65"
        >
          {changePassword.isPending ? 'Saving password…' : 'Save password'}
        </button>
      </form>
    </>
  );
}
