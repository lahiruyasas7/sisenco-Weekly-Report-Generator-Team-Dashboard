'use client';

import { useState, type FormEvent } from 'react';
import { CreateUserForm, EditUserForm } from '@/components/admin/user-editor';
import {
  useDeactivateUser,
  useUpdateUser,
  useUsers,
} from '@/lib/hooks/use-users';
import { useCurrentUser } from '@/lib/hooks/use-auth';
import type { PublicUser, UserRole } from '@/lib/types';

type RoleFilter = UserRole | 'ALL';
type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';
type EditorState = { mode: 'create' } | { mode: 'edit'; user: PublicUser };

const PAGE_SIZE = 10;

export function AdminUsersPage() {
  const currentUser = useCurrentUser();
  const [role, setRole] = useState<RoleFilter>('ALL');
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [confirmationUser, setConfirmationUser] = useState<PublicUser | null>(
    null,
  );
  const [actionError, setActionError] = useState('');

  const usersQuery = useUsers({
    page,
    limit: PAGE_SIZE,
    ...(role !== 'ALL' ? { role } : {}),
    ...(status !== 'ALL' ? { isActive: status === 'ACTIVE' } : {}),
    ...(search ? { search } : {}),
  });
  const updateUser = useUpdateUser();
  const deactivateUser = useDeactivateUser();
  const users = usersQuery.data?.data ?? [];
  const meta = usersQuery.data?.meta;

  function resetPageAndCloseEditor() {
    setPage(1);
    setEditor(null);
  }

  function applySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  }

  async function confirmDeactivation() {
    if (!confirmationUser) return;
    setActionError('');
    try {
      await deactivateUser.mutateAsync(confirmationUser.id);
      if (users.length === 1 && page > 1)
        setPage((currentPage) => currentPage - 1);
      setConfirmationUser(null);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Unable to deactivate this user. Please try again.',
      );
    }
  }

  async function reactivate(user: PublicUser) {
    setActionError('');
    try {
      await updateUser.mutateAsync({
        userId: user.id,
        input: { isActive: true },
      });
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Unable to reactivate this user. Please try again.',
      );
    }
  }

  const isActionPending = updateUser.isPending || deactivateUser.isPending;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="mt-1 text-sm text-[#66716d]">
            Create accounts and manage team access.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditor({ mode: 'create' })}
          className="h-9 rounded-md bg-[#0c7c72] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#096b62] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0c7c72]"
        >
          Create user
        </button>
      </header>

      {actionError ? (
        <p
          className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700"
          role="alert"
        >
          {actionError}
        </p>
      ) : null}

      {editor ? (
        <section
          className="rounded-xl border border-[#dedfdc] bg-white p-6 sm:p-7"
          aria-labelledby="user-editor-heading"
        >
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="user-editor-heading" className="text-base font-semibold">
                {editor.mode === 'create' ? 'Create user' : 'Edit user'}
              </h2>
              <p className="mt-1 text-sm text-[#66716d]">
                {editor.mode === 'create'
                  ? 'New accounts must change their temporary password at sign in.'
                  : `Update details for ${editor.user.email}.`}
              </p>
            </div>
            <button
              type="button"
              aria-label="Close user editor"
              onClick={() => setEditor(null)}
              className="rounded px-2 py-1 text-sm text-[#66716d] hover:bg-[#f6f7f5]"
            >
              Close
            </button>
          </div>
          {editor.mode === 'create' ? (
            <CreateUserForm onCreated={resetPageAndCloseEditor} />
          ) : (
            <EditUserForm
              key={editor.user.id}
              user={editor.user}
              onSaved={() => setEditor(null)}
            />
          )}
        </section>
      ) : null}

      <section className="rounded-xl border border-[#dedfdc] bg-white p-5 sm:p-6">
        <form
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1fr)_180px_180px_auto] lg:items-end"
          onSubmit={applySearch}
        >
          <div className="space-y-1.5">
            <label
              htmlFor="users-search"
              className="block text-[13px] text-[#545f5b]"
            >
              Search users
            </label>
            <input
              id="users-search"
              type="search"
              maxLength={100}
              value={searchInput}
              onChange={(event) => setSearchInput(event.currentTarget.value)}
              placeholder="Name or email"
              className="h-10 w-full rounded-md border border-[#c9ccc7] bg-white px-3 text-sm outline-none transition focus:border-[#0c7c72] focus:ring-2 focus:ring-[#0c7c72]/15"
            />
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="users-role-filter"
              className="block text-[13px] text-[#545f5b]"
            >
              Role
            </label>
            <select
              id="users-role-filter"
              value={role}
              onChange={(event) => {
                setRole(event.currentTarget.value as RoleFilter);
                setPage(1);
              }}
              className="h-10 w-full rounded-md border border-[#c9ccc7] bg-white px-3 text-sm outline-none focus:border-[#0c7c72] focus:ring-2 focus:ring-[#0c7c72]/15"
            >
              <option value="ALL">All roles</option>
              <option value="MEMBER">Member</option>
              <option value="MANAGER">Manager</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="users-status-filter"
              className="block text-[13px] text-[#545f5b]"
            >
              Account status
            </label>
            <select
              id="users-status-filter"
              value={status}
              onChange={(event) => {
                setStatus(event.currentTarget.value as StatusFilter);
                setPage(1);
              }}
              className="h-10 w-full rounded-md border border-[#c9ccc7] bg-white px-3 text-sm outline-none focus:border-[#0c7c72] focus:ring-2 focus:ring-[#0c7c72]/15"
            >
              <option value="ALL">All accounts</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
          <button
            type="submit"
            className="h-10 rounded-md border border-[#d7dcd8] px-4 text-sm font-medium text-[#38433e] hover:bg-[#f6f7f5]"
          >
            Search
          </button>
        </form>
      </section>

      <section className="overflow-hidden rounded-xl border border-[#dedfdc] bg-white">
        {usersQuery.isError ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-red-700" role="alert">
              We couldn’t load users. Please try again.
            </p>
            <button
              type="button"
              className="mt-3 text-sm font-medium text-[#08796f] underline underline-offset-2"
              onClick={() => void usersQuery.refetch()}
            >
              Try again
            </button>
          </div>
        ) : usersQuery.isLoading ? (
          <p
            className="px-6 py-12 text-center text-sm text-[#66716d]"
            role="status"
          >
            Loading users…
          </p>
        ) : users.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-[#38433e]">
              {search || role !== 'ALL' || status !== 'ALL'
                ? 'No users match these filters.'
                : 'No users yet.'}
            </p>
            <p className="mt-1 text-sm text-[#66716d]">
              Adjust your search or create a user account.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse text-left text-sm">
                <thead className="bg-[#f6f7f5] text-xs uppercase tracking-wide text-[#66716d]">
                  <tr>
                    <th className="px-5 py-3 font-medium">User</th>
                    <th className="px-5 py-3 font-medium">Role</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 text-right font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eceeeb]">
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td className="px-5 py-4">
                        <p className="font-medium text-[#202623]">
                          {user.name}
                        </p>
                        <p className="mt-0.5 text-xs text-[#66716d]">
                          {user.email}
                        </p>
                      </td>
                      <td className="px-5 py-4 capitalize text-[#38433e]">
                        {user.role.toLowerCase()}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${user.isActive ? 'bg-[#e7f4ef] text-[#17654e]' : 'bg-[#f1f1ef] text-[#66716d]'}`}
                        >
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        {confirmationUser?.id === user.id ? (
                          <div
                            className="ml-auto max-w-xs space-y-2 text-left"
                            role="group"
                            aria-label={`Confirm deactivation for ${user.name}`}
                          >
                            <p className="text-xs text-[#66716d]">
                              Deactivate {user.name}? They will lose access.
                            </p>
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setConfirmationUser(null)}
                                className="rounded-md border border-[#d7dcd8] px-2.5 py-1.5 text-xs font-medium hover:bg-[#f6f7f5]"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                disabled={deactivateUser.isPending}
                                onClick={() => void confirmDeactivation()}
                                className="rounded-md bg-red-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-60"
                              >
                                {deactivateUser.isPending
                                  ? 'Deactivating…'
                                  : 'Confirm deactivation'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-3">
                            <button
                              type="button"
                              onClick={() => setEditor({ mode: 'edit', user })}
                              className="text-sm font-medium text-[#08796f] hover:underline"
                            >
                              Edit
                            </button>
                            {user.isActive ? (
                              <button
                                type="button"
                                disabled={
                                  user.id === currentUser.data?.id ||
                                  isActionPending
                                }
                                onClick={() => setConfirmationUser(user)}
                                title={
                                  user.id === currentUser.data?.id
                                    ? 'You cannot deactivate your own account.'
                                    : undefined
                                }
                                className="text-sm font-medium text-red-700 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Deactivate
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={isActionPending}
                                onClick={() => void reactivate(user)}
                                className="text-sm font-medium text-[#08796f] hover:underline disabled:opacity-50"
                              >
                                Reactivate
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#eceeeb] px-5 py-4">
              <p className="text-xs text-[#66716d]">
                {meta?.total ?? users.length} user
                {(meta?.total ?? users.length) === 1 ? '' : 's'}
                {meta
                  ? ` · Page ${meta.page} of ${Math.max(meta.totalPages, 1)}`
                  : ''}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1 || usersQuery.isFetching}
                  onClick={() => setPage((currentPage) => currentPage - 1)}
                  className="rounded-md border border-[#d7dcd8] px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={
                    !meta || page >= meta.totalPages || usersQuery.isFetching
                  }
                  onClick={() => setPage((currentPage) => currentPage + 1)}
                  className="rounded-md border border-[#d7dcd8] px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
