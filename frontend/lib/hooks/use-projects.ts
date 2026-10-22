import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api-client';
import type {
  AssignableMember,
  CreateProjectInput,
  PaginatedResponse,
  Project,
  ProjectListParams,
  UpdateProjectInput,
} from '@/lib/types';

function normalizeParams(
  params: ProjectListParams,
): Required<ProjectListParams> {
  return {
    page: params.page ?? 1,
    limit: params.limit ?? 20,
    includeArchived: params.includeArchived ?? false,
  };
}

export const projectQueryKeys = {
  all: ['projects'] as const,
  lists: () => [...projectQueryKeys.all, 'list'] as const,
  list: (params: ProjectListParams = {}) =>
    [...projectQueryKeys.lists(), normalizeParams(params)] as const,
  assignableMembers: () =>
    [...projectQueryKeys.all, 'assignable-members'] as const,
};

function listPath(params: Required<ProjectListParams>): string {
  const search = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit),
    includeArchived: String(params.includeArchived),
  });
  return `/projects?${search.toString()}`;
}

export function useProjects(params: ProjectListParams = {}) {
  const normalized = normalizeParams(params);
  return useQuery({
    queryKey: projectQueryKeys.list(normalized),
    queryFn: () => apiRequest<PaginatedResponse<Project>>(listPath(normalized)),
    retry: false,
    staleTime: 30_000,
  });
}

export function useAssignableMembers(enabled: boolean) {
  return useQuery({
    queryKey: projectQueryKeys.assignableMembers(),
    queryFn: () =>
      apiRequest<{ data: AssignableMember[] }>('/projects/assignable-members'),
    enabled,
    retry: false,
    staleTime: 60_000,
  });
}

export function useProjectMembers(
  projectId: string | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: [...projectQueryKeys.all, 'members', projectId] as const,
    queryFn: () =>
      apiRequest<{ projectId: string; memberIds: string[] }>(
        `/projects/${encodeURIComponent(projectId ?? '')}/members`,
      ),
    enabled: Boolean(projectId) && enabled,
    retry: false,
  });
}

function useInvalidateProjects() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: projectQueryKeys.all });
}

export function useCreateProject() {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: (input: CreateProjectInput) =>
      apiRequest<Project>('/projects', { method: 'POST', body: input }),
    onSuccess: invalidate,
  });
}

export function useUpdateProject() {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: ({
      projectId,
      input,
    }: {
      projectId: string;
      input: UpdateProjectInput;
    }) =>
      apiRequest<Project>(`/projects/${encodeURIComponent(projectId)}`, {
        method: 'PATCH',
        body: input,
      }),
    onSuccess: invalidate,
  });
}

export function useDeleteProject() {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: (projectId: string) =>
      apiRequest<void>(`/projects/${encodeURIComponent(projectId)}`, {
        method: 'DELETE',
      }),
    onSuccess: invalidate,
  });
}

export function useReplaceProjectMembers() {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: ({
      projectId,
      memberIds,
    }: {
      projectId: string;
      memberIds: string[];
    }) =>
      apiRequest<{ projectId: string; memberIds: string[] }>(
        `/projects/${encodeURIComponent(projectId)}/members`,
        { method: 'PUT', body: { memberIds } },
      ),
    onSuccess: invalidate,
  });
}
