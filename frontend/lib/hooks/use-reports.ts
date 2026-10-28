import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api-client';
import type {
  CreateReportInput,
  ManagerReportListItem,
  ManagerReportListParams,
  PaginatedResponse,
  Report,
  ReportListItem,
  ReportListParams,
  ReportReviewHistoryItem,
  ReportVersion,
  ReportVersionSummary,
  ReviewReportInput,
  UpdateReportInput,
} from '@/lib/types';

type NormalizedReportListParams = {
  page: number;
  limit: number;
  status?: ReportListParams['status'];
  from?: string;
  to?: string;
};

type NormalizedManagerReportListParams = Required<
  Pick<ManagerReportListParams, 'page' | 'limit'>
> &
  Omit<ManagerReportListParams, 'page' | 'limit'>;

function normalizeParams(params: ReportListParams): NormalizedReportListParams {
  return {
    page: params.page ?? 1,
    limit: params.limit ?? 20,
    ...(params.status ? { status: params.status } : {}),
    ...(params.from ? { from: params.from } : {}),
    ...(params.to ? { to: params.to } : {}),
  };
}

function normalizeManagerParams(
  params: ManagerReportListParams,
): NormalizedManagerReportListParams {
  return {
    page: params.page ?? 1,
    limit: params.limit ?? 20,
    ...(params.weekStart ? { weekStart: params.weekStart } : {}),
    ...(params.from ? { from: params.from } : {}),
    ...(params.to ? { to: params.to } : {}),
    ...(params.userId ? { userId: params.userId } : {}),
    ...(params.projectId ? { projectId: params.projectId } : {}),
    ...(params.status ? { status: params.status } : {}),
  };
}

export const reportQueryKeys = {
  all: ['reports'] as const,
  managerLists: () => [...reportQueryKeys.all, 'manager-list'] as const,
  managerList: (params: ManagerReportListParams = {}) =>
    [
      ...reportQueryKeys.managerLists(),
      normalizeManagerParams(params),
    ] as const,
  mine: (params: ReportListParams = {}) =>
    [...reportQueryKeys.all, 'mine', normalizeParams(params)] as const,
  detail: (reportId: string | undefined) =>
    [...reportQueryKeys.all, 'detail', reportId] as const,
  versions: (reportId: string | undefined) =>
    [...reportQueryKeys.all, 'versions', reportId] as const,
  version: (reportId: string | undefined, versionNumber: number) =>
    [...reportQueryKeys.all, 'version', reportId, versionNumber] as const,
  reviews: (reportId: string | undefined) =>
    [...reportQueryKeys.all, 'reviews', reportId] as const,
};

function historyPath(params: NormalizedReportListParams): string {
  const search = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit),
  });
  if (params.status) search.set('status', params.status);
  if (params.from) search.set('from', params.from);
  if (params.to) search.set('to', params.to);
  return `/reports/me?${search.toString()}`;
}

function managerListPath(params: NormalizedManagerReportListParams): string {
  const search = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit),
  });
  if (params.weekStart) search.set('weekStart', params.weekStart);
  if (params.from) search.set('from', params.from);
  if (params.to) search.set('to', params.to);
  if (params.userId) search.set('userId', params.userId);
  if (params.projectId) search.set('projectId', params.projectId);
  if (params.status) search.set('status', params.status);
  return `/reports?${search.toString()}`;
}

export function useManagerReports(params: ManagerReportListParams = {}) {
  const normalized = normalizeManagerParams(params);
  return useQuery({
    queryKey: reportQueryKeys.managerList(normalized),
    queryFn: () =>
      apiRequest<PaginatedResponse<ManagerReportListItem>>(
        managerListPath(normalized),
      ),
    retry: false,
    staleTime: 15_000,
  });
}

export function useMyReports(params: ReportListParams = {}) {
  const normalized = normalizeParams(params);
  return useQuery({
    queryKey: reportQueryKeys.mine(normalized),
    queryFn: () =>
      apiRequest<PaginatedResponse<ReportListItem>>(historyPath(normalized)),
    retry: false,
    staleTime: 15_000,
  });
}

export function useReportVersions(reportId: string | undefined) {
  return useQuery({
    queryKey: reportQueryKeys.versions(reportId),
    queryFn: () =>
      apiRequest<{ data: ReportVersionSummary[] }>(
        `/reports/${encodeURIComponent(reportId ?? '')}/versions`,
      ),
    enabled: Boolean(reportId),
    retry: false,
    staleTime: 15_000,
  });
}

export function useReportVersion(
  reportId: string | undefined,
  versionNumber: number,
  enabled = true,
) {
  return useQuery({
    queryKey: reportQueryKeys.version(reportId, versionNumber),
    queryFn: () =>
      apiRequest<ReportVersion>(
        `/reports/${encodeURIComponent(reportId ?? '')}/versions/${versionNumber}`,
      ),
    enabled: Boolean(reportId) && versionNumber > 0 && enabled,
    retry: false,
    staleTime: 30_000,
  });
}

export function useReportReviews(reportId: string | undefined) {
  return useQuery({
    queryKey: reportQueryKeys.reviews(reportId),
    queryFn: () =>
      apiRequest<{ data: ReportReviewHistoryItem[] }>(
        `/reports/${encodeURIComponent(reportId ?? '')}/reviews`,
      ),
    enabled: Boolean(reportId),
    retry: false,
    staleTime: 15_000,
  });
}

export function useReport(reportId: string | undefined) {
  return useQuery({
    queryKey: reportQueryKeys.detail(reportId),
    queryFn: () =>
      apiRequest<Report>(`/reports/${encodeURIComponent(reportId ?? '')}`),
    enabled: Boolean(reportId),
    retry: false,
  });
}

export function useReviewReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      reportId,
      input,
    }: {
      reportId: string;
      input: ReviewReportInput;
    }) =>
      apiRequest<Report>(`/reports/${encodeURIComponent(reportId)}/review`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: async (report) => {
      queryClient.setQueryData(reportQueryKeys.detail(report.id), report);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: reportQueryKeys.managerLists(),
        }),
        queryClient.invalidateQueries({
          queryKey: reportQueryKeys.versions(report.id),
        }),
        queryClient.invalidateQueries({
          queryKey: reportQueryKeys.reviews(report.id),
        }),
      ]);
    },
  });
}

function useInvalidateMyReports() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({
      queryKey: [...reportQueryKeys.all, 'mine'],
    });
}

export function useCreateReport() {
  const queryClient = useQueryClient();
  const invalidateMine = useInvalidateMyReports();
  return useMutation({
    mutationFn: (input: CreateReportInput) =>
      apiRequest<Report>('/reports', { method: 'POST', body: input }),
    onSuccess: async (report) => {
      queryClient.setQueryData(reportQueryKeys.detail(report.id), report);
      await invalidateMine();
    },
  });
}

export function useUpdateReport() {
  const queryClient = useQueryClient();
  const invalidateMine = useInvalidateMyReports();
  return useMutation({
    mutationFn: ({
      reportId,
      input,
    }: {
      reportId: string;
      input: UpdateReportInput;
    }) =>
      apiRequest<Report>(`/reports/${encodeURIComponent(reportId)}`, {
        method: 'PATCH',
        body: input,
      }),
    onSuccess: async (report) => {
      queryClient.setQueryData(reportQueryKeys.detail(report.id), report);
      await invalidateMine();
    },
  });
}

export function useSubmitReport() {
  const queryClient = useQueryClient();
  const invalidateMine = useInvalidateMyReports();
  return useMutation({
    mutationFn: (reportId: string) =>
      apiRequest<Report>(`/reports/${encodeURIComponent(reportId)}/submit`, {
        method: 'POST',
      }),
    onSuccess: async (report) => {
      queryClient.setQueryData(reportQueryKeys.detail(report.id), report);
      await invalidateMine();
    },
  });
}

export function useDeleteReport() {
  const queryClient = useQueryClient();
  const invalidateMine = useInvalidateMyReports();
  return useMutation({
    mutationFn: (reportId: string) =>
      apiRequest<void>(`/reports/${encodeURIComponent(reportId)}`, {
        method: 'DELETE',
      }),
    onSuccess: async (_result, reportId) => {
      queryClient.removeQueries({
        queryKey: reportQueryKeys.detail(reportId),
      });
      await invalidateMine();
    },
  });
}
