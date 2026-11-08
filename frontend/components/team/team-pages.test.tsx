import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamMemberProfilePage } from '@/components/team/team-member-profile-page';
import { TeamMembersPage } from '@/components/team/team-members-page';
import { TeamSectionsPage } from '@/components/team/team-sections-page';
import { TeamWeekPage } from '@/components/team/team-week-page';
import type {
  TeamMemberProfile,
  PaginatedResponse,
  TeamMemberListItem,
  TeamSectionResponse,
  TeamWeekStatusResponse,
} from '@/lib/types';

const mocks = vi.hoisted(() => ({
  useTeamWeekStatus: vi.fn(),
  useTeamSection: vi.fn(),
  useTeamMemberProfile: vi.fn(),
  useTeamMembers: vi.fn(),
}));

vi.mock('@/lib/hooks/use-team', () => ({
  useTeamWeekStatus: mocks.useTeamWeekStatus,
  useTeamSection: mocks.useTeamSection,
}));

vi.mock('@/lib/hooks/use-users', () => ({
  useTeamMemberProfile: mocks.useTeamMemberProfile,
  useTeamMembers: mocks.useTeamMembers,
}));

const weekStatus: TeamWeekStatusResponse = {
  weekStart: '2026-11-02',
  weekEnd: '2026-11-08',
  data: [
    { user: { id: 'member-1', name: 'Alice Member' }, status: 'DRAFT' },
    {
      user: { id: 'member-2', name: 'Bob Member' },
      status: 'SUBMITTED',
      reportId: 'report-2',
    },
    {
      user: { id: 'member-3', name: 'Casey Member' },
      status: 'NOT_STARTED',
      reportId: null,
    },
  ],
};

const sectionResponse: TeamSectionResponse = {
  weekStart: '2026-11-02',
  weekEnd: '2026-11-08',
  section: 'blockers',
  data: [
    {
      user: { id: 'member-2', name: 'Bob Member' },
      reportId: 'report-2',
      content: [
        {
          description: 'Waiting on access',
          isKey: true,
          isResolved: false,
        },
      ],
    },
  ],
};

const memberProfile: TeamMemberProfile = {
  user: {
    id: 'member-2',
    name: 'Bob Member',
    isActive: false,
    createdAt: '2026-01-10T00:00:00.000Z',
  },
  stats: {
    reportsByStatus: {
      DRAFT: 1,
      SUBMITTED: 2,
      NEEDS_CORRECTION: 1,
      APPROVED: 6,
    },
    onTimeRate: 0.75,
    averageWeeklySpentHours: 32.5,
  },
};

describe('Slice 6 team pages', () => {
  beforeEach(() => {
    mocks.useTeamWeekStatus.mockReturnValue({
      data: weekStatus,
      isError: false,
      isLoading: false,
      refetch: vi.fn(),
    });
    mocks.useTeamSection.mockReturnValue({
      data: sectionResponse,
      isError: false,
      isLoading: false,
      refetch: vi.fn(),
    });
    mocks.useTeamMemberProfile.mockReturnValue({
      data: memberProfile,
      isError: false,
      isLoading: false,
      refetch: vi.fn(),
    });
    const roster: PaginatedResponse<TeamMemberListItem> = {
      data: [
        {
          id: 'member-2',
          name: 'Bob Member',
          reportsByStatus: {
            DRAFT: 1,
            SUBMITTED: 2,
            NEEDS_CORRECTION: 1,
            APPROVED: 6,
          },
        },
      ],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    };
    mocks.useTeamMembers.mockReturnValue({
      data: roster,
      isError: false,
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
    });
  });

  it('shows team report statuses and never links to a draft report', () => {
    render(<TeamWeekPage />);

    expect(
      screen.getByRole('heading', { name: 'Team week' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Alice Member')).toHaveAttribute(
      'href',
      '/manager/team/member-1',
    );
    const draftRow = screen.getByRole('row', {
      name: /Alice Member Draft/,
    });
    expect(
      screen.getByText('Draft content is only visible to its owner.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View report' })).toHaveAttribute(
      'href',
      '/manager/reports/report-2/review',
    );
    expect(
      within(draftRow).queryByRole('link', { name: 'View report' }),
    ).not.toBeInTheDocument();
    expect(mocks.useTeamWeekStatus).toHaveBeenCalledWith(
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    );
  });

  it('filters members by status and name', () => {
    render(<TeamWeekPage />);

    fireEvent.change(screen.getByLabelText('Search members'), {
      target: { value: 'casey' },
    });
    expect(screen.getByText('Casey Member')).toBeInTheDocument();
    expect(screen.queryByText('Alice Member')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Search members'), {
      target: { value: '' },
    });
    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'NOT_STARTED' },
    });
    expect(screen.getByText('Casey Member')).toBeInTheDocument();
    expect(screen.queryByText('Bob Member')).not.toBeInTheDocument();
  });

  it('loads side-by-side section snapshot content and related links', () => {
    render(<TeamSectionsPage />);

    expect(
      screen.getByRole('heading', { name: 'Team sections' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Waiting on access')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View report' })).toHaveAttribute(
      'href',
      '/manager/reports/report-2/review',
    );
    expect(mocks.useTeamSection).toHaveBeenCalledWith(
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      'blockers',
    );
  });

  it('shows all-time metrics and inactive state on a member profile', () => {
    render(<TeamMemberProfilePage userId="member-2" />);

    expect(
      screen.getByRole('heading', { name: 'Bob Member' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('32.50')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(mocks.useTeamMemberProfile).toHaveBeenCalledWith('member-2');
  });

  it('lists members with report counts and links to their profiles', () => {
    render(<TeamMembersPage />);

    expect(
      screen.getByRole('heading', { name: 'Team members' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Bob Member' })).toHaveAttribute(
      'href',
      '/manager/team/member-2',
    );
    expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute(
      'href',
      '/manager/team/member-2',
    );
    expect(mocks.useTeamMembers).toHaveBeenCalledWith(1, 20);
  });

  it('shows a retryable error state for a failed team request', () => {
    const refetch = vi.fn();
    mocks.useTeamWeekStatus.mockReturnValue({
      data: undefined,
      isError: true,
      isLoading: false,
      refetch,
    });
    render(<TeamWeekPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalledOnce();
  });
});
