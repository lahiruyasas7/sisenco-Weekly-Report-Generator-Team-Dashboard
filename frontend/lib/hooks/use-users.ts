import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api-client';
import type {
  CreateUserInput,
  PaginatedResponse,
  PublicUser,
  UpdateUserInput,
  UserListParams,
} from '@/lib/types';

function normalizeListParams(params: UserListParams): UserListParams {
  const search = params.search?.trim();

  return {
    page: params.page ?? 1,
    limit: params.limit ?? 20,
    ...(params.role ? { role: params.role } : {}),
    ...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
    ...(search ? { search } : {}),
  };
}

export const userQueryKeys = {
  all: ['users'] as const,
  lists: () => [...userQueryKeys.all, 'list'] as const,
  list: (params: UserListParams = {}) =>
    [...userQueryKeys.lists(), normalizeListParams(params)] as const,
};

function buildListPath(params: UserListParams): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) searchParams.set(key, String(value));
  }

  return `/users?${searchParams.toString()}`;
}

export function useUsers(params: UserListParams = {}) {
  const normalizedParams = normalizeListParams(params);

  return useQuery({
    queryKey: userQueryKeys.list(normalizedParams),
    queryFn: () =>
      apiRequest<PaginatedResponse<PublicUser>>(
        buildListPath(normalizedParams),
      ),
    retry: false,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateUserInput) =>
      apiRequest<PublicUser>('/users', {
        method: 'POST',
        body: input,
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: userQueryKeys.lists() }),
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      input,
    }: {
      userId: string;
      input: UpdateUserInput;
    }) =>
      apiRequest<PublicUser>(`/users/${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        body: input,
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: userQueryKeys.lists() }),
  });
}

export function useDeactivateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) =>
      apiRequest<void>(`/users/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: userQueryKeys.lists() }),
  });
}
