import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminUsersPage } from '@/components/admin/admin-users-page';
import type { PaginatedResponse, PublicUser } from '@/lib/types';

const mocks = vi.hoisted(() => ({
  useUsers: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deactivateUser: vi.fn(),
  refetch: vi.fn(),
  createPending: vi.fn(),
  updatePending: vi.fn(),
  deactivatePending: vi.fn(),
  useCurrentUser: vi.fn(),
}));

vi.mock('@/lib/hooks/use-users', () => ({
  useUsers: mocks.useUsers,
  useCreateUser: () => ({
    isPending: mocks.createPending(),
    mutateAsync: mocks.createUser,
  }),
  useUpdateUser: () => ({
    isPending: mocks.updatePending(),
    mutateAsync: mocks.updateUser,
  }),
  useDeactivateUser: () => ({
    isPending: mocks.deactivatePending(),
    mutateAsync: mocks.deactivateUser,
  }),
}));

vi.mock('@/lib/hooks/use-auth', () => ({
  useCurrentUser: mocks.useCurrentUser,
}));

const admin: PublicUser = {
  id: 'admin-1',
  email: 'admin@example.com',
  name: 'Admin',
  role: 'ADMIN',
  isActive: true,
  mustChangePassword: false,
  createdAt: '2026-10-20T00:00:00.000Z',
};

const member: PublicUser = {
  id: 'member-1',
  email: 'member@example.com',
  name: 'Member One',
  role: 'MEMBER',
  isActive: true,
  mustChangePassword: false,
  createdAt: '2026-10-20T00:00:00.000Z',
};

function listResponse(
  data: PublicUser[] = [member],
  page = 1,
  totalPages = 2,
): PaginatedResponse<PublicUser> {
  return {
    data,
    meta: { page, limit: 10, total: 11, totalPages },
  };
}

describe('AdminUsersPage', () => {
  beforeEach(() => {
    mocks.useCurrentUser.mockReturnValue({ data: admin });
    mocks.useUsers.mockReturnValue({
      data: listResponse(),
      isError: false,
      isFetching: false,
      isLoading: false,
      refetch: mocks.refetch,
    });
    mocks.createUser.mockResolvedValue(member);
    mocks.updateUser.mockResolvedValue(member);
    mocks.deactivateUser.mockResolvedValue(undefined);
    mocks.createPending.mockReturnValue(false);
    mocks.updatePending.mockReturnValue(false);
    mocks.deactivatePending.mockReturnValue(false);
  });

  it('shows a loading state while users are being fetched', () => {
    mocks.useUsers.mockReturnValue({
      data: undefined,
      isError: false,
      isFetching: true,
      isLoading: true,
      refetch: mocks.refetch,
    });

    render(<AdminUsersPage />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading users…');
  });

  it('shows an empty state when no users match', () => {
    mocks.useUsers.mockReturnValue({
      data: listResponse([], 1, 0),
      isError: false,
      isFetching: false,
      isLoading: false,
      refetch: mocks.refetch,
    });

    render(<AdminUsersPage />);

    expect(screen.getByText('No users yet.')).toBeInTheDocument();
  });

  it('applies role filters and moves through pages', async () => {
    const userActions = userEvent.setup();
    render(<AdminUsersPage />);

    await userActions.selectOptions(screen.getByLabelText('Role'), 'MANAGER');
    await waitFor(() =>
      expect(mocks.useUsers).toHaveBeenLastCalledWith(
        expect.objectContaining({ role: 'MANAGER', page: 1 }),
      ),
    );

    await userActions.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() =>
      expect(mocks.useUsers).toHaveBeenLastCalledWith(
        expect.objectContaining({ role: 'MANAGER', page: 2 }),
      ),
    );
  });

  it('submits a trimmed search and an inactive-account filter', async () => {
    const userActions = userEvent.setup();
    render(<AdminUsersPage />);

    await userActions.selectOptions(
      screen.getByLabelText('Account status'),
      'INACTIVE',
    );
    await userActions.type(
      screen.getByRole('searchbox'),
      '  inactive.person  ',
    );
    await userActions.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() =>
      expect(mocks.useUsers).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 1,
          isActive: false,
          search: 'inactive.person',
        }),
      ),
    );
  });

  it('creates an account with the selected role and temporary password', async () => {
    const userActions = userEvent.setup();
    render(<AdminUsersPage />);

    await userActions.click(
      screen.getByRole('button', { name: 'Create user' }),
    );
    const createRegion = screen.getByRole('region', { name: 'Create user' });
    await userActions.type(
      within(createRegion).getByLabelText('Name'),
      'New Manager',
    );
    await userActions.type(
      within(createRegion).getByLabelText('Email'),
      'new.manager@example.com',
    );
    await userActions.selectOptions(
      within(createRegion).getByLabelText('Role'),
      'MANAGER',
    );
    await userActions.type(
      within(createRegion).getByLabelText('Temporary password'),
      'StrongTempPass123',
    );
    await userActions.click(
      screen.getByRole('button', { name: 'Create account' }),
    );

    await waitFor(() =>
      expect(mocks.createUser).toHaveBeenCalledWith({
        name: 'New Manager',
        email: 'new.manager@example.com',
        role: 'MANAGER',
        temporaryPassword: 'StrongTempPass123',
      }),
    );
    expect(screen.queryByRole('heading', { name: 'Create user' })).toBeNull();
  });

  it('edits a user name and role', async () => {
    const userActions = userEvent.setup();
    render(<AdminUsersPage />);

    await userActions.click(screen.getByRole('button', { name: 'Edit' }));
    const editRegion = screen.getByRole('region', { name: 'Edit user' });
    const nameInput = within(editRegion).getByLabelText('Name');
    await userActions.clear(nameInput);
    await userActions.type(nameInput, 'Updated Person');
    await userActions.selectOptions(
      within(editRegion).getByLabelText('Role'),
      'MANAGER',
    );
    await userActions.click(
      within(editRegion).getByRole('button', { name: 'Save changes' }),
    );

    await waitFor(() =>
      expect(mocks.updateUser).toHaveBeenCalledWith({
        userId: member.id,
        input: { name: 'Updated Person', role: 'MANAGER' },
      }),
    );
  });

  it('requires confirmation before deactivating an account', async () => {
    const userActions = userEvent.setup();
    render(<AdminUsersPage />);

    await userActions.click(screen.getByRole('button', { name: 'Deactivate' }));
    expect(
      screen.getByRole('group', {
        name: 'Confirm deactivation for Member One',
      }),
    ).toBeInTheDocument();
    expect(mocks.deactivateUser).not.toHaveBeenCalled();

    await userActions.click(
      screen.getByRole('button', { name: 'Confirm deactivation' }),
    );
    await waitFor(() =>
      expect(mocks.deactivateUser).toHaveBeenCalledWith(member.id),
    );
  });

  it('renders an error state with a retry action', async () => {
    const userActions = userEvent.setup();
    mocks.useUsers.mockReturnValue({
      data: undefined,
      isError: true,
      isFetching: false,
      isLoading: false,
      refetch: mocks.refetch,
    });
    render(<AdminUsersPage />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'We couldn’t load users.',
    );
    await userActions.click(screen.getByRole('button', { name: 'Try again' }));
    expect(mocks.refetch).toHaveBeenCalledOnce();
  });
});
