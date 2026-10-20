import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PasswordSettingsForm } from '@/components/settings/password-settings-form';

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  replace: vi.fn(),
}));

vi.mock('@/lib/hooks/use-auth', () => ({
  useChangePassword: () => ({
    isPending: false,
    mutateAsync: mocks.mutateAsync,
  }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));

describe('PasswordSettingsForm', () => {
  beforeEach(() => {
    mocks.mutateAsync.mockResolvedValue(undefined);
  });

  it('changes the password and sends the user back to login', async () => {
    const userActions = userEvent.setup();
    render(<PasswordSettingsForm />);

    await userActions.type(
      screen.getByLabelText('Current password'),
      'CurrentPassword1',
    );
    await userActions.type(
      screen.getByLabelText('New password'),
      'BetterPassword123',
    );
    await userActions.type(
      screen.getByLabelText('Confirm new password'),
      'BetterPassword123',
    );
    await userActions.click(
      screen.getByRole('button', { name: 'Change password' }),
    );

    await waitFor(() =>
      expect(mocks.mutateAsync).toHaveBeenCalledWith({
        currentPassword: 'CurrentPassword1',
        newPassword: 'BetterPassword123',
      }),
    );
    expect(mocks.replace).toHaveBeenCalledWith('/login?passwordChanged=1');
  });

  it('rejects mismatched password confirmation', async () => {
    const userActions = userEvent.setup();
    render(<PasswordSettingsForm />);

    await userActions.type(
      screen.getByLabelText('Current password'),
      'CurrentPassword1',
    );
    await userActions.type(
      screen.getByLabelText('New password'),
      'BetterPassword123',
    );
    await userActions.type(
      screen.getByLabelText('Confirm new password'),
      'NotTheSamePassword',
    );
    await userActions.click(
      screen.getByRole('button', { name: 'Change password' }),
    );

    expect(
      await screen.findByText('Passwords do not match.'),
    ).toBeInTheDocument();
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });
});
