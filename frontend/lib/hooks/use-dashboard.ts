import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api-client';
import type {
  DashboardActivity,
  DashboardStatusByMember,
  DashboardSummary,
  DashboardTasksTrend,
  DashboardWorkloadByProject,
  DashboardTimeByType,
} from '@/lib/types';

export type DashboardDateRange = {
  from: string;
  to: string;
};

export type DashboardTasksTrendParams = DashboardDateRange & {
  userId?: string;
};

export const dashboardQueryKeys = {
  all: ['dashboard'] as const,
  summary: (weekStart: string) =>
    [...dashboardQueryKeys.all, 'summary', weekStart] as const,
  tasksTrend: (params: DashboardTasksTrendParams) =>
    [...dashboardQueryKeys.all, 'tasks-trend', params] as const,
  statusByMember: (weekStart: string) =>
    [...dashboardQueryKeys.all, 'status-by-member', weekStart] as const,
  workloadByProject: (params: DashboardDateRange) =>
    [...dashboardQueryKeys.all, 'workload-by-project', params] as const,
  timeByType: (params: DashboardDateRange) =>
    [...dashboardQueryKeys.all, 'time-by-type', params] as const,
  activity: (limit: number) =>
    [...dashboardQueryKeys.all, 'activity', limit] as const,
};

export function useDashboardSummary(weekStart: string) {
  return useQuery({
    queryKey: dashboardQueryKeys.summary(weekStart),
    queryFn: () =>
      apiRequest<DashboardSummary>(
        `/dashboard/summary?weekStart=${encodeURIComponent(weekStart)}`,
      ),
    retry: false,
    staleTime: 30_000,
  });
}

export function useDashboardTasksTrend(params: DashboardTasksTrendParams) {
  const search = new URLSearchParams({ from: params.from, to: params.to });
  if (params.userId) search.set('userId', params.userId);

  return useQuery({
    queryKey: dashboardQueryKeys.tasksTrend(params),
    queryFn: () =>
      apiRequest<DashboardTasksTrend>(`/dashboard/tasks-trend?${search}`),
    retry: false,
    staleTime: 30_000,
  });
}

export function useDashboardStatusByMember(weekStart: string) {
  return useQuery({
    queryKey: dashboardQueryKeys.statusByMember(weekStart),
    queryFn: () =>
      apiRequest<DashboardStatusByMember>(
        `/dashboard/status-by-member?weekStart=${encodeURIComponent(weekStart)}`,
      ),
    retry: false,
    staleTime: 30_000,
  });
}

export function useDashboardWorkloadByProject(params: DashboardDateRange) {
  const search = new URLSearchParams({ from: params.from, to: params.to });

  return useQuery({
    queryKey: dashboardQueryKeys.workloadByProject(params),
    queryFn: () =>
      apiRequest<DashboardWorkloadByProject>(
        `/dashboard/workload-by-project?${search}`,
      ),
    retry: false,
    staleTime: 30_000,
  });
}

export function useDashboardTimeByType(params: DashboardDateRange) {
  const search = new URLSearchParams({ from: params.from, to: params.to });

  return useQuery({
    queryKey: dashboardQueryKeys.timeByType(params),
    queryFn: () =>
      apiRequest<DashboardTimeByType>(`/dashboard/time-by-type?${search}`),
    retry: false,
    staleTime: 30_000,
  });
}

export function useDashboardActivity(limit = 20) {
  return useQuery({
    queryKey: dashboardQueryKeys.activity(limit),
    queryFn: () =>
      apiRequest<DashboardActivity>(
        `/dashboard/activity?limit=${encodeURIComponent(String(limit))}`,
      ),
    retry: false,
    staleTime: 30_000,
  });
}
