'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { AuthField, authInputClassName } from '@/components/auth/auth-field';
import { useChangePassword } from '@/lib/hooks/use-auth';
import { changePasswordSchema } from '@/lib/validators/auth';
import type { z } from 'zod';

type PasswordValues = z.infer<typeof changePasswordSchema>;

export function PasswordSettingsForm() {
  const router = useRouter();
  const changePassword = useChangePassword();
  const form = useForm<PasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });
  const serverError = form.formState.errors.root?.server?.message;

  async function onSubmit(values: PasswordValues) {
    form.clearErrors('root.server');
    try {
      await changePassword.mutateAsync({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      router.replace('/login?passwordChanged=1');
    } catch (error) {
      form.setError('root.server', {
        type: 'server',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to change your password. Please try again.',
      });
    }
  }

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <AuthField
        id="settings-current-password"
        label="Current password"
        error={form.formState.errors.currentPassword?.message}
      >
        <input
          id="settings-current-password"
          type="password"
          autoComplete="current-password"
          aria-invalid={Boolean(form.formState.errors.currentPassword)}
          aria-describedby={
            form.formState.errors.currentPassword
              ? 'settings-current-password-error'
              : undefined
          }
          className={authInputClassName}
          {...form.register('currentPassword')}
        />
      </AuthField>
      <AuthField
        id="settings-new-password"
        label="New password"
        error={form.formState.errors.newPassword?.message}
      >
        <input
          id="settings-new-password"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(form.formState.errors.newPassword)}
          aria-describedby={
            form.formState.errors.newPassword
              ? 'settings-new-password-error'
              : undefined
          }
          className={authInputClassName}
          {...form.register('newPassword')}
        />
      </AuthField>
      <AuthField
        id="settings-confirm-password"
        label="Confirm new password"
        error={form.formState.errors.confirmPassword?.message}
      >
        <input
          id="settings-confirm-password"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(form.formState.errors.confirmPassword)}
          aria-describedby={
            form.formState.errors.confirmPassword
              ? 'settings-confirm-password-error'
              : undefined
          }
          className={authInputClassName}
          {...form.register('confirmPassword')}
        />
      </AuthField>
      {serverError ? (
        <p role="alert" className="text-sm text-red-700">
          {serverError}
        </p>
      ) : null}
      <p className="text-xs leading-5 text-[#66716d]">
        Changing your password signs you out. Sign in again with your new
        password.
      </p>
      <button
        type="submit"
        disabled={changePassword.isPending}
        className="h-9 rounded-md bg-[#0c7c72] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#096b62] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0c7c72] disabled:cursor-not-allowed disabled:opacity-65"
      >
        {changePassword.isPending ? 'Changing password…' : 'Change password'}
      </button>
    </form>
  );
}
