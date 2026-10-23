import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api-client';
import type {
  CreateReportInput,
  PaginatedResponse,
  Report,
  ReportListItem,
  ReportListParams,
  UpdateReportInput,
} from '@/lib/types';

type NormalizedReportListParams = {
  page: number;
  limit: number;
  status?: ReportListParams['status'];
  from?: string;
  to?: string;
};

function normalizeParams(params: ReportListParams): NormalizedReportListParams {
  return {
    page: params.page ?? 1,
    limit: params.limit ?? 20,
    ...(params.status ? { status: params.status } : {}),
    ...(params.from ? { from: params.from } : {}),
    ...(params.to ? { to: params.to } : {}),
  };
}

export const reportQueryKeys = {
  all: ['reports'] as const,
  mine: (params: ReportListParams = {}) =>
    [...reportQueryKeys.all, 'mine', normalizeParams(params)] as const,
  detail: (reportId: string | undefined) =>
    [...reportQueryKeys.all, 'detail', reportId] as const,
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

export function useReport(reportId: string | undefined) {
  return useQuery({
    queryKey: reportQueryKeys.detail(reportId),
    queryFn: () =>
      apiRequest<Report>(`/reports/${encodeURIComponent(reportId ?? '')}`),
    enabled: Boolean(reportId),
    retry: false,
  });
}

function useInvalidateReports() {
  const queryClient = useQueryClient();
  return async (reportId?: string) => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: [...reportQueryKeys.all, 'mine'],
      }),
      ...(reportId
        ? [
            queryClient.invalidateQueries({
              queryKey: reportQueryKeys.detail(reportId),
            }),
          ]
        : []),
    ]);
  };
}

export function useCreateReport() {
  const invalidate = useInvalidateReports();
  return useMutation({
    mutationFn: (input: CreateReportInput) =>
      apiRequest<Report>('/reports', { method: 'POST', body: input }),
    onSuccess: async (report) => invalidate(report.id),
  });
}

export function useUpdateReport() {
  const invalidate = useInvalidateReports();
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
    onSuccess: async (report) => invalidate(report.id),
  });
}

export function useSubmitReport() {
  const invalidate = useInvalidateReports();
  return useMutation({
    mutationFn: (reportId: string) =>
      apiRequest<Report>(`/reports/${encodeURIComponent(reportId)}/submit`, {
        method: 'POST',
      }),
    onSuccess: async (report) => invalidate(report.id),
  });
}

export function useDeleteReport() {
  const invalidate = useInvalidateReports();
  return useMutation({
    mutationFn: (reportId: string) =>
      apiRequest<void>(`/reports/${encodeURIComponent(reportId)}`, {
        method: 'DELETE',
      }),
    onSuccess: async () => invalidate(),
  });
}
