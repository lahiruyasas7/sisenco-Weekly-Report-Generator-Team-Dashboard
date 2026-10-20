import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfileSettingsForm } from '@/components/settings/profile-settings-form';
import type { PublicUser } from '@/lib/types';

const { mutateAsync } = vi.hoisted(() => ({ mutateAsync: vi.fn() }));

vi.mock('@/lib/hooks/use-auth', () => ({
  useUpdateProfile: () => ({ isPending: false, mutateAsync }),
}));

const user: PublicUser = {
  id: 'user-1',
  email: 'person@example.com',
  name: 'Current Name',
  role: 'MEMBER',
  isActive: true,
  mustChangePassword: false,
  createdAt: '2026-10-20T00:00:00.000Z',
};

describe('ProfileSettingsForm', () => {
  beforeEach(() => {
    mutateAsync.mockResolvedValue(user);
  });

  it('submits a trimmed name and displays success feedback', async () => {
    const userActions = userEvent.setup();
    render(<ProfileSettingsForm user={user} />);

    const nameInput = screen.getByRole('textbox', { name: 'Name' });
    await userActions.clear(nameInput);
    await userActions.type(nameInput, '  Updated Name  ');
    await userActions.click(screen.getByRole('button', { name: 'Save name' }));

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({ name: 'Updated Name' }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Your name has been updated.',
    );
  });

  it('requires a non-empty name', async () => {
    const userActions = userEvent.setup();
    render(<ProfileSettingsForm user={user} />);

    await userActions.clear(screen.getByRole('textbox', { name: 'Name' }));
    await userActions.click(screen.getByRole('button', { name: 'Save name' }));

    expect(await screen.findByText('Enter your name.')).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});
