'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { AuthField, authInputClassName } from '@/components/auth/auth-field';
import { useUpdateProfile } from '@/lib/hooks/use-auth';
import type { PublicUser } from '@/lib/types';
import { updateProfileSchema } from '@/lib/validators/settings';
import type { z } from 'zod';

type ProfileValues = z.infer<typeof updateProfileSchema>;

export function ProfileSettingsForm({ user }: { user: PublicUser }) {
  const updateProfile = useUpdateProfile();
  const form = useForm<ProfileValues>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { name: user.name },
  });

  async function onSubmit(values: ProfileValues) {
    form.clearErrors('root.server');
    try {
      await updateProfile.mutateAsync(values);
      form.setError('root.server', {
        type: 'success',
        message: 'Your name has been updated.',
      });
    } catch (error) {
      form.setError('root.server', {
        type: 'server',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to update your name. Please try again.',
      });
    }
  }

  const feedback = form.formState.errors.root?.server;

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <AuthField
        id="profile-name"
        label="Name"
        error={form.formState.errors.name?.message}
      >
        <input
          id="profile-name"
          type="text"
          autoComplete="name"
          maxLength={100}
          aria-invalid={Boolean(form.formState.errors.name)}
          aria-describedby={
            form.formState.errors.name ? 'profile-name-error' : undefined
          }
          className={authInputClassName}
          {...form.register('name')}
        />
      </AuthField>
      {feedback ? (
        <p
          role={feedback.type === 'success' ? 'status' : 'alert'}
          className={
            feedback.type === 'success'
              ? 'text-sm text-[#08796f]'
              : 'text-sm text-red-700'
          }
        >
          {feedback.message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={updateProfile.isPending}
        className="h-9 rounded-md bg-[#0c7c72] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#096b62] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0c7c72] disabled:cursor-not-allowed disabled:opacity-65"
      >
        {updateProfile.isPending ? 'Saving…' : 'Save name'}
      </button>
    </form>
  );
}
