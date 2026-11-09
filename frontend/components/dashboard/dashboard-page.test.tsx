import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardPage } from '@/components/dashboard/dashboard-page';

const mocks = vi.hoisted(() => ({
  useCurrentUser: vi.fn(),
  useDashboardSummary: vi.fn(),
  useDashboardTasksTrend: vi.fn(),
  useDashboardStatusByMember: vi.fn(),
  useDashboardWorkloadByProject: vi.fn(),
  useDashboardTimeByType: vi.fn(),
  useDashboardActivity: vi.fn(),
}));

vi.mock('@/lib/hooks/use-auth', () => ({
  useCurrentUser: mocks.useCurrentUser,
}));

vi.mock('@/lib/hooks/use-dashboard', () => ({
  useDashboardSummary: mocks.useDashboardSummary,
  useDashboardTasksTrend: mocks.useDashboardTasksTrend,
  useDashboardStatusByMember: mocks.useDashboardStatusByMember,
  useDashboardWorkloadByProject: mocks.useDashboardWorkloadByProject,
  useDashboardTimeByType: mocks.useDashboardTimeByType,
  useDashboardActivity: mocks.useDashboardActivity,
}));

vi.mock('recharts', () => {
  const MockChart = ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Bar: MockChart,
    BarChart: MockChart,
    CartesianGrid: MockChart,
    Cell: MockChart,
    ComposedChart: MockChart,
    Legend: MockChart,
    Line: MockChart,
    LineChart: MockChart,
    Pie: MockChart,
    PieChart: MockChart,
    ResponsiveContainer: MockChart,
    Tooltip: MockChart,
    XAxis: MockChart,
    YAxis: MockChart,
  };
});

const summary = {
  weekStart: '2026-11-02',
  weekEnd: '2026-11-08',
  totalSubmitted: 3,
  compliance: { onTime: 2, late: 1, pending: 1, eligible: 4 },
  needsCorrection: 1,
  openBlockers: 2,
};

describe('DashboardPage', () => {
  beforeEach(() => {
    mocks.useCurrentUser.mockReturnValue({
      data: {
        id: 'manager-1',
        email: 'manager@example.test',
        name: 'Morgan Manager',
        role: 'MANAGER',
      },
      isLoading: false,
    });
    mocks.useDashboardSummary.mockReturnValue({
      data: summary,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    mocks.useDashboardTasksTrend.mockReturnValue({
      data: {
        data: [{ weekStart: '2026-10-19', completedTasks: 5 }],
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    mocks.useDashboardStatusByMember.mockReturnValue({
      data: {
        data: [
          { user: { id: 'member-1', name: 'Alice Member' }, status: 'DRAFT' },
        ],
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    mocks.useDashboardWorkloadByProject.mockReturnValue({
      data: {
        data: [
          {
            projectId: 'project-1',
            projectName: 'Client A',
            taskCount: 3,
            spentHours: 12.5,
          },
        ],
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    mocks.useDashboardTimeByType.mockReturnValue({
      data: { data: [{ taskType: 'DEVELOPMENT', hours: 10 }] },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    mocks.useDashboardActivity.mockReturnValue({
      data: {
        data: [
          {
            id: 'version-1',
            type: 'SUBMISSION',
            timestamp: '2026-11-08T10:00:00.000Z',
            reportId: 'report-1',
            weekStart: '2026-11-02',
            versionNumber: 1,
            member: { id: 'member-1', name: 'Alice Member' },
            submittedBy: { id: 'member-1', name: 'Alice Member' },
          },
          {
            id: 'review-1',
            type: 'REVIEW',
            timestamp: '2026-11-08T11:00:00.000Z',
            reportId: 'report-1',
            weekStart: '2026-11-02',
            action: 'CHANGES_REQUESTED',
            comment: 'Please add details.',
            member: { id: 'member-1', name: 'Alice Member' },
            reviewer: { id: 'manager-1', name: 'Morgan Manager' },
          },
        ],
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  it('renders team metrics, charts, activity, and review links for managers', async () => {
    render(<DashboardPage initialWeekStart="2026-11-02" />);

    expect(
      await screen.findByRole('heading', { name: 'Team dashboard' }),
    ).toBeVisible();
    expect(screen.getByText('Reports submitted')).toBeVisible();
    expect(screen.getByText('Submission compliance')).toBeVisible();
    expect(screen.getByText('Needs correction')).toBeVisible();
    expect(screen.getByText('Open blockers')).toBeVisible();
    expect(
      screen.getByRole('region', { name: 'Completed tasks trend' }),
    ).toBeVisible();
    expect(
      screen.getByRole('region', { name: 'Report status by member' }),
    ).toBeVisible();
    expect(
      screen.getByRole('region', { name: 'Workload by project' }),
    ).toBeVisible();
    expect(
      screen.getByRole('region', { name: 'Time by task type' }),
    ).toBeVisible();
    expect(
      screen.getByRole('link', { name: /requested changes/i }),
    ).toHaveAttribute('href', '/manager/reports/report-1/review');
  });

  it('keeps members on the member home and does not request dashboard data', () => {
    mocks.useCurrentUser.mockReturnValue({
      data: {
        id: 'member-1',
        email: 'member@example.test',
        name: 'Member',
        role: 'MEMBER',
      },
      isLoading: false,
    });

    render(<DashboardPage initialWeekStart="2026-11-02" />);

    expect(
      screen.getByRole('heading', { name: 'Welcome to Weekly Reports' }),
    ).toBeVisible();
    expect(mocks.useDashboardSummary).not.toHaveBeenCalled();
  });

  it('shows a retry state when a dashboard section fails', () => {
    const refetch = vi.fn();
    mocks.useDashboardSummary.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch,
    });

    render(<DashboardPage initialWeekStart="2026-11-02" />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'We couldn’t load the weekly summary.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalledOnce();
  });
});
