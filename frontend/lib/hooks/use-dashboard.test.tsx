import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { apiRequest } from '@/lib/api-client';
import {
  dashboardQueryKeys,
  useDashboardActivity,
  useDashboardStatusByMember,
  useDashboardSummary,
  useDashboardTasksTrend,
  useDashboardTimeByType,
  useDashboardWorkloadByProject,
} from '@/lib/hooks/use-dashboard';
import type {
  DashboardActivity,
  DashboardStatusByMember,
  DashboardSummary,
  DashboardTasksTrend,
  DashboardTimeByType,
  DashboardWorkloadByProject,
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

describe('dashboard query hooks', () => {
  it('loads the selected week summary', async () => {
    const response: DashboardSummary = {
      weekStart: '2026-11-02',
      weekEnd: '2026-11-08',
      totalSubmitted: 3,
      compliance: { onTime: 2, late: 1, pending: 0, eligible: 3 },
      needsCorrection: 1,
      openBlockers: 2,
    };
    vi.mocked(apiRequest).mockResolvedValue(response);
    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(() => useDashboardSummary('2026-11-02'), {
      wrapper,
    });

    await waitFor(() => expect(result.current.data).toEqual(response));
    expect(apiRequest).toHaveBeenCalledWith(
      '/dashboard/summary?weekStart=2026-11-02',
    );
    expect(dashboardQueryKeys.summary('2026-11-02')).toEqual([
      'dashboard',
      'summary',
      '2026-11-02',
    ]);
    queryClient.clear();
  });

  it('loads task trend with an optional encoded member id', async () => {
    const response: DashboardTasksTrend = {
      from: '2026-10-19',
      to: '2026-10-26',
      data: [{ weekStart: '2026-10-19', completedTasks: 5 }],
    };
    vi.mocked(apiRequest).mockResolvedValue(response);
    const params = {
      from: '2026-10-19',
      to: '2026-10-26',
      userId: 'member/1',
    };
    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(() => useDashboardTasksTrend(params), {
      wrapper,
    });

    await waitFor(() => expect(result.current.data).toEqual(response));
    expect(apiRequest).toHaveBeenCalledWith(
      '/dashboard/tasks-trend?from=2026-10-19&to=2026-10-26&userId=member%2F1',
    );
    queryClient.clear();
  });

  it('loads member status, project workload, and time aggregates', async () => {
    const status: DashboardStatusByMember = {
      weekStart: '2026-11-02',
      weekEnd: '2026-11-08',
      data: [{ user: { id: 'm1', name: 'Member' }, status: 'NOT_STARTED' }],
    };
    const workload: DashboardWorkloadByProject = {
      from: '2026-10-19',
      to: '2026-10-26',
      data: [],
    };
    const time: DashboardTimeByType = {
      from: '2026-10-19',
      to: '2026-10-26',
      data: [{ taskType: 'MEETINGS', hours: 2 }],
    };
    vi.mocked(apiRequest)
      .mockResolvedValueOnce(status)
      .mockResolvedValueOnce(workload)
      .mockResolvedValueOnce(time);
    const { queryClient, wrapper } = createWrapper();

    const statusHook = renderHook(
      () => useDashboardStatusByMember('2026-11-02'),
      { wrapper },
    );
    const workloadHook = renderHook(
      () =>
        useDashboardWorkloadByProject({
          from: '2026-10-19',
          to: '2026-10-26',
        }),
      { wrapper },
    );
    const timeHook = renderHook(
      () => useDashboardTimeByType({ from: '2026-10-19', to: '2026-10-26' }),
      { wrapper },
    );

    await waitFor(() => expect(statusHook.result.current.data).toEqual(status));
    await waitFor(() =>
      expect(workloadHook.result.current.data).toEqual(workload),
    );
    await waitFor(() => expect(timeHook.result.current.data).toEqual(time));
    expect(apiRequest).toHaveBeenNthCalledWith(
      1,
      '/dashboard/status-by-member?weekStart=2026-11-02',
    );
    expect(apiRequest).toHaveBeenNthCalledWith(
      2,
      '/dashboard/workload-by-project?from=2026-10-19&to=2026-10-26',
    );
    expect(apiRequest).toHaveBeenNthCalledWith(
      3,
      '/dashboard/time-by-type?from=2026-10-19&to=2026-10-26',
    );
    queryClient.clear();
  });

  it('loads recent activity using the requested limit', async () => {
    const response: DashboardActivity = { data: [] };
    vi.mocked(apiRequest).mockResolvedValue(response);
    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(() => useDashboardActivity(10), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual(response));
    expect(apiRequest).toHaveBeenCalledWith('/dashboard/activity?limit=10');
    expect(dashboardQueryKeys.activity(10)).toEqual([
      'dashboard',
      'activity',
      10,
    ]);
    queryClient.clear();
  });
});
