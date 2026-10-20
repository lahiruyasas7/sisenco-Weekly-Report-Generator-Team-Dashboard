import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { authQueryKeys } from '@/lib/hooks/use-auth';
import { useUpdateUser, userQueryKeys } from '@/lib/hooks/use-users';
import type { PublicUser } from '@/lib/types';

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }));

vi.mock('@/lib/api-client', () => ({ apiRequest }));

const currentUser: PublicUser = {
  id: 'admin-1',
  email: 'admin@example.com',
  name: 'Admin',
  role: 'ADMIN',
  isActive: true,
  mustChangePassword: false,
  createdAt: '2026-10-20T00:00:00.000Z',
};

describe('useUpdateUser', () => {
  it('invalidates user lists and updates the auth cache when the admin edits themself', async () => {
    const updatedUser: PublicUser = {
      ...currentUser,
      name: 'Updated Admin',
      role: 'MANAGER',
    };
    apiRequest.mockResolvedValue(updatedUser);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    queryClient.setQueryData(authQueryKeys.currentUser(), currentUser);
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useUpdateUser(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        userId: currentUser.id,
        input: { name: updatedUser.name, role: updatedUser.role },
      });
    });

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: userQueryKeys.lists(),
    });
    expect(queryClient.getQueryData(authQueryKeys.currentUser())).toEqual(
      updatedUser,
    );
    queryClient.clear();
  });
});
