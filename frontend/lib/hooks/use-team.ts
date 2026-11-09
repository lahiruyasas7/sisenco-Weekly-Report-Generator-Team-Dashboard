import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api-client';
import type {
  TeamSection,
  TeamSectionResponse,
  TeamWeekStatusResponse,
} from '@/lib/types';

export const teamQueryKeys = {
  all: ['team'] as const,
  weekStatus: (weekStart: string) =>
    [...teamQueryKeys.all, 'week-status', weekStart] as const,
  section: (weekStart: string, section: TeamSection) =>
    [...teamQueryKeys.all, 'sections', weekStart, section] as const,
};

export function useTeamWeekStatus(weekStart: string) {
  return useQuery({
    queryKey: teamQueryKeys.weekStatus(weekStart),
    queryFn: () =>
      apiRequest<TeamWeekStatusResponse>(
        `/team/week-status?weekStart=${encodeURIComponent(weekStart)}`,
      ),
    retry: false,
    staleTime: 30_000,
  });
}

export function useTeamSection(weekStart: string, section: TeamSection) {
  return useQuery({
    queryKey: teamQueryKeys.section(weekStart, section),
    queryFn: () =>
      apiRequest<TeamSectionResponse>(
        `/team/sections?weekStart=${encodeURIComponent(weekStart)}&section=${section}`,
      ),
    retry: false,
    staleTime: 30_000,
  });
}
