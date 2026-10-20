import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api-client';
import type {
  ChangePasswordInput,
  LoginInput,
  PublicUser,
  RegisterInput,
  UpdateProfileInput,
} from '@/lib/types';

export const authQueryKeys = {
  all: ['auth'] as const,
  currentUser: () => [...authQueryKeys.all, 'current-user'] as const,
};

export function useCurrentUser() {
  return useQuery({
    queryKey: authQueryKeys.currentUser(),
    queryFn: () => apiRequest<PublicUser>('/auth/me'),
    retry: false,
    staleTime: 60_000,
  });
}

export function useLogin() {
  return useMutation({
    mutationFn: (input: LoginInput) =>
      apiRequest<PublicUser>('/auth/login', {
        method: 'POST',
        body: input,
        redirectOnUnauthorized: false,
      }),
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: (input: RegisterInput) =>
      apiRequest<PublicUser>('/auth/register', {
        method: 'POST',
        body: input,
        redirectOnUnauthorized: false,
      }),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiRequest<void>('/auth/logout', {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.clear();
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateProfileInput) =>
      apiRequest<PublicUser>('/auth/me', {
        method: 'PATCH',
        body: input,
      }),
    onSuccess: (user) => {
      queryClient.setQueryData(authQueryKeys.currentUser(), user);
    },
  });
}

export function useChangePassword() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ChangePasswordInput) =>
      apiRequest<void>('/auth/change-password', {
        method: 'POST',
        body: input,
        redirectOnUnauthorized: false,
      }),
    onSuccess: () => {
      queryClient.clear();
    },
  });
}
