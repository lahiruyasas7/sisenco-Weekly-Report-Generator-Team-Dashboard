import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { apiRequest } from '@/lib/api-client';
import {
  reportQueryKeys,
  useManagerReports,
  useReviewReport,
} from '@/lib/hooks/use-reports';
import type {
  PaginatedResponse,
  Report,
  ManagerReportListItem,
} from '@/lib/types';

vi.mock('@/lib/api-client', () => ({ apiRequest: vi.fn() }));

const report: Report = {
  id: 'report-1',
  user: { id: 'member-1', name: 'Member One' },
  status: 'APPROVED',
  currentVersion: 1,
  submittedAt: '2026-10-20T12:00:00.000Z',
  firstSubmittedAt: '2026-10-20T12:00:00.000Z',
  reviewedAt: '2026-10-21T12:00:00.000Z',
  latestReview: null,
  content: {
    weekStart: '2026-10-19',
    weekEnd: '2026-10-25',
    project: { id: 'project-1', name: 'Client A' },
    tasks: [],
    nextWeekTasks: [],
    blockers: [],
    achievements: [],
    timeEntries: [],
    notes: '',
    links: [],
  },
};

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe('manager report hooks', () => {
  it('builds the manager report-list request from supplied filters', async () => {
    const item: ManagerReportListItem = {
      id: report.id,
      userId: report.user.id,
      user: report.user,
      weekStart: report.content.weekStart,
      weekEnd: report.content.weekEnd,
      status: 'SUBMITTED',
      currentVersion: 1,
      submittedAt: report.submittedAt,
      project: report.content.project,
    };
    const response: PaginatedResponse<ManagerReportListItem> = {
      data: [item],
      meta: { page: 2, limit: 10, total: 11, totalPages: 2 },
    };
    vi.mocked(apiRequest).mockResolvedValue(response);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { result } = renderHook(
      () =>
        useManagerReports({
          page: 2,
          limit: 10,
          weekStart: '2026-10-19',
          userId: 'member-1',
          projectId: 'project-1',
          status: 'SUBMITTED',
        }),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => expect(result.current.data).toEqual(response));
    expect(apiRequest).toHaveBeenCalledWith(
      '/reports?page=2&limit=10&weekStart=2026-10-19&userId=member-1&projectId=project-1&status=SUBMITTED',
    );
    queryClient.clear();
  });

  it('posts review input and refreshes manager list, versions, and review history', async () => {
    vi.mocked(apiRequest).mockResolvedValue(report);
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useReviewReport(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        reportId: report.id,
        input: { action: 'APPROVED' },
      });
    });

    expect(apiRequest).toHaveBeenCalledWith('/reports/report-1/review', {
      method: 'POST',
      body: { action: 'APPROVED' },
    });
    expect(queryClient.getQueryData(reportQueryKeys.detail(report.id))).toEqual(
      report,
    );
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: reportQueryKeys.managerLists(),
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: reportQueryKeys.versions(report.id),
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: reportQueryKeys.reviews(report.id),
    });
    queryClient.clear();
  });
});
