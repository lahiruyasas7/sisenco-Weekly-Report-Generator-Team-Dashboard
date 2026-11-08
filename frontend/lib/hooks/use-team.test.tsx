import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { apiRequest } from '@/lib/api-client';
import {
  teamQueryKeys,
  useTeamSection,
  useTeamWeekStatus,
} from '@/lib/hooks/use-team';
import { useTeamMemberProfile, useTeamMembers } from '@/lib/hooks/use-users';
import type {
  PaginatedResponse,
  TeamMemberListItem,
  TeamMemberProfile,
  TeamSectionResponse,
  TeamWeekStatusResponse,
} from '@/lib/types';

vi.mock('@/lib/api-client', () => ({ apiRequest: vi.fn() }));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return {
    queryClient,
    wrapper({ children }: { children: ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );
    },
  };
}

describe('team query hooks', () => {
  it('requests week status for the selected week', async () => {
    const response: TeamWeekStatusResponse = {
      weekStart: '2026-11-02',
      weekEnd: '2026-11-08',
      data: [],
    };
    vi.mocked(apiRequest).mockResolvedValue(response);
    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(() => useTeamWeekStatus('2026-11-02'), {
      wrapper,
    });

    await waitFor(() => expect(result.current.data).toEqual(response));
    expect(apiRequest).toHaveBeenCalledWith(
      '/team/week-status?weekStart=2026-11-02',
    );
    expect(teamQueryKeys.weekStatus('2026-11-02')).toEqual([
      'team',
      'week-status',
      '2026-11-02',
    ]);
    queryClient.clear();
  });

  it('requests the selected report section', async () => {
    const response: TeamSectionResponse = {
      weekStart: '2026-11-02',
      weekEnd: '2026-11-08',
      section: 'notes',
      data: [],
    };
    vi.mocked(apiRequest).mockResolvedValue(response);
    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(() => useTeamSection('2026-11-02', 'notes'), {
      wrapper,
    });

    await waitFor(() => expect(result.current.data).toEqual(response));
    expect(apiRequest).toHaveBeenCalledWith(
      '/team/sections?weekStart=2026-11-02&section=notes',
    );
    queryClient.clear();
  });

  it('requests the paginated team roster', async () => {
    const response: PaginatedResponse<TeamMemberListItem> = {
      data: [],
      meta: { page: 2, limit: 10, total: 15, totalPages: 2 },
    };
    vi.mocked(apiRequest).mockResolvedValue(response);
    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(() => useTeamMembers(2, 10), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual(response));
    expect(apiRequest).toHaveBeenCalledWith('/users/team?page=2&limit=10');
    queryClient.clear();
  });

  it('requests a team member profile by encoded id', async () => {
    const response: TeamMemberProfile = {
      user: {
        id: 'member/1',
        name: 'Member',
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      stats: {
        reportsByStatus: {
          DRAFT: 0,
          SUBMITTED: 0,
          NEEDS_CORRECTION: 0,
          APPROVED: 0,
        },
        onTimeRate: null,
        averageWeeklySpentHours: 0,
      },
    };
    vi.mocked(apiRequest).mockResolvedValue(response);
    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(() => useTeamMemberProfile('member/1'), {
      wrapper,
    });

    await waitFor(() => expect(result.current.data).toEqual(response));
    expect(apiRequest).toHaveBeenCalledWith('/users/member%2F1/profile');
    queryClient.clear();
  });
});
