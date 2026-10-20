'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { AuthField, authInputClassName } from '@/components/auth/auth-field';
import { useCreateUser, useUpdateUser } from '@/lib/hooks/use-users';
import type { PublicUser, UserRole } from '@/lib/types';
import {
  adminCreateUserSchema,
  adminUpdateUserSchema,
} from '@/lib/validators/settings';
import type { z } from 'zod';

type CreateUserValues = z.infer<typeof adminCreateUserSchema>;
type UpdateUserValues = z.infer<typeof adminUpdateUserSchema>;

const roleOptions: { value: UserRole; label: string }[] = [
  { value: 'MEMBER', label: 'Member' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'ADMIN', label: 'Admin' },
];

const selectClassName = `${authInputClassName} h-10`;

export function CreateUserForm({ onCreated }: { onCreated: () => void }) {
  const createUser = useCreateUser();
  const form = useForm<CreateUserValues>({
    resolver: zodResolver(adminCreateUserSchema),
    defaultValues: {
      name: '',
      email: '',
      role: 'MEMBER',
      temporaryPassword: '',
    },
  });
  const serverError = form.formState.errors.root?.server?.message;

  async function onSubmit(values: CreateUserValues) {
    form.clearErrors('root.server');
    try {
      await createUser.mutateAsync(values);
      onCreated();
    } catch (error) {
      form.setError('root.server', {
        type: 'server',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to create the user. Please try again.',
      });
    }
  }

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <AuthField
          id="create-user-name"
          label="Name"
          error={form.formState.errors.name?.message}
        >
          <input
            id="create-user-name"
            type="text"
            autoComplete="name"
            maxLength={100}
            aria-invalid={Boolean(form.formState.errors.name)}
            aria-describedby={
              form.formState.errors.name ? 'create-user-name-error' : undefined
            }
            className={authInputClassName}
            {...form.register('name')}
          />
        </AuthField>
        <AuthField
          id="create-user-email"
          label="Email"
          error={form.formState.errors.email?.message}
        >
          <input
            id="create-user-email"
            type="email"
            autoComplete="email"
            maxLength={254}
            aria-invalid={Boolean(form.formState.errors.email)}
            aria-describedby={
              form.formState.errors.email
                ? 'create-user-email-error'
                : undefined
            }
            className={authInputClassName}
            {...form.register('email')}
          />
        </AuthField>
        <AuthField
          id="create-user-role"
          label="Role"
          error={form.formState.errors.role?.message}
        >
          <select
            id="create-user-role"
            aria-invalid={Boolean(form.formState.errors.role)}
            aria-describedby={
              form.formState.errors.role ? 'create-user-role-error' : undefined
            }
            className={selectClassName}
            {...form.register('role')}
          >
            {roleOptions.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
        </AuthField>
        <AuthField
          id="create-user-password"
          label="Temporary password"
          error={form.formState.errors.temporaryPassword?.message}
        >
          <input
            id="create-user-password"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(form.formState.errors.temporaryPassword)}
            aria-describedby={
              form.formState.errors.temporaryPassword
                ? 'create-user-password-error'
                : undefined
            }
            className={authInputClassName}
            {...form.register('temporaryPassword')}
          />
        </AuthField>
      </div>
      {serverError ? (
        <p role="alert" className="text-sm text-red-700">
          {serverError}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={createUser.isPending}
          className="h-9 rounded-md bg-[#0c7c72] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#096b62] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0c7c72] disabled:cursor-not-allowed disabled:opacity-65"
        >
          {createUser.isPending ? 'Creating…' : 'Create account'}
        </button>
        <button
          type="button"
          onClick={onCreated}
          className="h-9 rounded-md border border-[#d7dcd8] px-4 text-sm font-medium text-[#38433e] hover:bg-[#f6f7f5]"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export function EditUserForm({
  user,
  onSaved,
}: {
  user: PublicUser;
  onSaved: () => void;
}) {
  const updateUser = useUpdateUser();
  const form = useForm<UpdateUserValues>({
    resolver: zodResolver(adminUpdateUserSchema),
    defaultValues: { name: user.name, role: user.role },
  });
  const serverError = form.formState.errors.root?.server?.message;

  async function onSubmit(values: UpdateUserValues) {
    form.clearErrors('root.server');
    try {
      await updateUser.mutateAsync({ userId: user.id, input: values });
      onSaved();
    } catch (error) {
      form.setError('root.server', {
        type: 'server',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to update the user. Please try again.',
      });
    }
  }

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <AuthField
          id="edit-user-name"
          label="Name"
          error={form.formState.errors.name?.message}
        >
          <input
            id="edit-user-name"
            type="text"
            autoComplete="name"
            maxLength={100}
            aria-invalid={Boolean(form.formState.errors.name)}
            aria-describedby={
              form.formState.errors.name ? 'edit-user-name-error' : undefined
            }
            className={authInputClassName}
            {...form.register('name')}
          />
        </AuthField>
        <AuthField
          id="edit-user-role"
          label="Role"
          error={form.formState.errors.role?.message}
        >
          <select
            id="edit-user-role"
            aria-invalid={Boolean(form.formState.errors.role)}
            aria-describedby={
              form.formState.errors.role ? 'edit-user-role-error' : undefined
            }
            className={selectClassName}
            {...form.register('role')}
          >
            {roleOptions.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
        </AuthField>
      </div>
      {serverError ? (
        <p role="alert" className="text-sm text-red-700">
          {serverError}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={updateUser.isPending}
          className="h-9 rounded-md bg-[#0c7c72] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#096b62] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0c7c72] disabled:cursor-not-allowed disabled:opacity-65"
        >
          {updateUser.isPending ? 'Saving…' : 'Save changes'}
        </button>
        <button
          type="button"
          onClick={onSaved}
          className="h-9 rounded-md border border-[#d7dcd8] px-4 text-sm font-medium text-[#38433e] hover:bg-[#f6f7f5]"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
