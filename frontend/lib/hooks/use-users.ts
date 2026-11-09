import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api-client';
import { authQueryKeys } from '@/lib/hooks/use-auth';
import type {
  CreateUserInput,
  PaginatedResponse,
  PublicUser,
  TeamMemberListItem,
  TeamMemberProfile,
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
  teamMembers: (page = 1, limit = 20) =>
    [...userQueryKeys.all, 'team', { page, limit }] as const,
  memberProfile: (userId: string | undefined) =>
    [...userQueryKeys.all, 'profile', userId] as const,
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

export function useTeamMembers(page = 1, limit = 20) {
  return useQuery({
    queryKey: userQueryKeys.teamMembers(page, limit),
    queryFn: () =>
      apiRequest<PaginatedResponse<TeamMemberListItem>>(
        `/users/team?page=${page}&limit=${limit}`,
      ),
    retry: false,
    staleTime: 30_000,
  });
}

export function useTeamMemberProfile(userId: string | undefined) {
  return useQuery({
    queryKey: userQueryKeys.memberProfile(userId),
    queryFn: () =>
      apiRequest<TeamMemberProfile>(
        `/users/${encodeURIComponent(userId ?? '')}/profile`,
      ),
    enabled: Boolean(userId),
    retry: false,
    staleTime: 30_000,
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
    onSuccess: (user) => {
      const invalidateLists = queryClient.invalidateQueries({
        queryKey: userQueryKeys.lists(),
      });
      const currentUser = queryClient.getQueryData<PublicUser>(
        authQueryKeys.currentUser(),
      );

      if (currentUser?.id === user.id) {
        queryClient.setQueryData(authQueryKeys.currentUser(), user);
      }

      return invalidateLists;
    },
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
