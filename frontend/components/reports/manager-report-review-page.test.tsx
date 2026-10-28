import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ManagerReportReviewPage } from '@/components/reports/manager-report-review-page';
import { ManagerReportsPage } from '@/components/reports/manager-reports-page';
import type {
  ManagerReportListItem,
  PaginatedResponse,
  Report,
  ReportReviewHistoryItem,
  ReportVersion,
  ReportVersionSummary,
} from '@/lib/types';

const {
  useManagerReports,
  useReport,
  useReportReviews,
  useReportVersion,
  useReportVersions,
  useReviewReport,
} = vi.hoisted(() => ({
  useManagerReports: vi.fn(),
  useReport: vi.fn(),
  useReportReviews: vi.fn(),
  useReportVersion: vi.fn(),
  useReportVersions: vi.fn(),
  useReviewReport: vi.fn(),
}));

vi.mock('@/lib/hooks/use-reports', () => ({
  useManagerReports,
  useReport,
  useReportReviews,
  useReportVersion,
  useReportVersions,
  useReviewReport,
}));

const report: Report = {
  id: 'report-1',
  user: { id: 'member-1', name: 'Nuwan Silva' },
  status: 'SUBMITTED',
  currentVersion: 2,
  submittedAt: '2026-09-26T09:12:00.000Z',
  firstSubmittedAt: '2026-09-26T09:12:00.000Z',
  reviewedAt: null,
  latestReview: null,
  content: {
    weekStart: '2026-09-21',
    weekEnd: '2026-09-27',
    project: { id: 'project-1', name: 'Client A' },
    tasks: [
      {
        name: 'Auth API login',
        priority: 'HIGH',
        plannedPercent: 100,
        actualPercent: 100,
        status: 'COMPLETED',
        plannedHours: 6,
        spentHours: 7,
        output: 'PR #214',
      },
    ],
    nextWeekTasks: [
      {
        description: 'Role guard integration tests',
        priority: 'HIGH',
        estimatedHours: 8,
      },
    ],
    blockers: [
      {
        description: 'Staging DB access delayed',
        isKey: true,
        isResolved: false,
      },
    ],
    achievements: [{ description: 'Cut login latency by 40%', isKey: true }],
    timeEntries: [{ taskType: 'DEVELOPMENT', hours: 22 }],
    notes: '',
    links: [],
  },
};

const listItem: ManagerReportListItem = {
  id: report.id,
  userId: report.user.id,
  user: report.user,
  weekStart: report.content.weekStart,
  weekEnd: report.content.weekEnd,
  status: report.status,
  currentVersion: report.currentVersion,
  submittedAt: report.submittedAt,
  project: report.content.project,
};

const versionSummaries: ReportVersionSummary[] = [
  {
    number: 2,
    submittedAt: '2026-09-26T09:12:00.000Z',
    reviews: [],
  },
  {
    number: 1,
    submittedAt: '2026-09-25T17:40:00.000Z',
    reviews: [
      {
        action: 'CHANGES_REQUESTED',
        comment: 'Split API work into separate tasks.',
        createdAt: '2026-09-25T18:00:00.000Z',
        reviewer: { id: 'manager-1', name: 'Asha Perera' },
      },
    ],
  },
];

const reviewHistory: ReportReviewHistoryItem[] = [
  {
    action: 'CHANGES_REQUESTED',
    comment: 'Split API work into separate tasks.',
    createdAt: '2026-09-25T18:00:00.000Z',
    reviewer: { id: 'manager-1', name: 'Asha Perera' },
    versionNumber: 1,
  },
];

const previousVersion: ReportVersion = {
  number: 1,
  submittedAt: versionSummaries[1].submittedAt,
  content: {
    ...report.content,
    tasks: [{ ...report.content.tasks[0], name: 'Old task version' }],
  },
  reviews: versionSummaries[1].reviews,
};

describe('ManagerReportsPage', () => {
  beforeEach(() => {
    const response: PaginatedResponse<ManagerReportListItem> = {
      data: [listItem],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    };
    useManagerReports.mockReturnValue({
      data: response,
      isError: false,
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
    });
  });

  it('lists reports and links to the manager review page', () => {
    render(<ManagerReportsPage />);

    expect(
      screen.getByRole('heading', { name: 'Team reports' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Nuwan Silva')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Review' })).toHaveAttribute(
      'href',
      '/manager/reports/report-1/review',
    );
    expect(useManagerReports).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
    });
  });

  it('shows an error and retry action when reports fail to load', () => {
    const refetch = vi.fn();
    useManagerReports.mockReturnValue({
      data: undefined,
      isError: true,
      isLoading: false,
      isFetching: false,
      refetch,
    });
    render(<ManagerReportsPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalledOnce();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'We couldn’t load team reports.',
    );
  });
});

describe('ManagerReportReviewPage', () => {
  const mutateAsync = vi.fn();
  const reset = vi.fn();

  beforeEach(() => {
    useReport.mockReturnValue({
      data: report,
      isError: false,
      isLoading: false,
      refetch: vi.fn(),
    });
    useReportVersions.mockReturnValue({
      data: { data: versionSummaries },
      isError: false,
      isLoading: false,
      refetch: vi.fn(),
    });
    useReportReviews.mockReturnValue({
      data: { data: reviewHistory },
      isError: false,
      isLoading: false,
      refetch: vi.fn(),
    });
    useReportVersion.mockReturnValue({
      data: previousVersion,
      isError: false,
      isLoading: false,
      refetch: vi.fn(),
    });
    mutateAsync.mockReset().mockResolvedValue(report);
    reset.mockReset();
    useReviewReport.mockReturnValue({
      mutateAsync,
      reset,
      isPending: false,
      isError: false,
      isSuccess: false,
      error: null,
    });
  });

  it('shows the submitted snapshot, review controls, versions, and comment history', () => {
    render(<ManagerReportReviewPage reportId={report.id} />);

    expect(
      screen.getByRole('heading', { name: 'Nuwan Silva · Client A' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Auth API login')).toBeInTheDocument();
    expect(screen.getByLabelText(/Comment \(required/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'View' })).toBeInTheDocument();
    expect(
      screen.getByText('Split API work into separate tasks.'),
    ).toBeInTheDocument();
    expect(useReportVersion).toHaveBeenCalledWith(report.id, 2, false);
  });

  it('requires a non-blank comment before requesting changes', () => {
    render(<ManagerReportReviewPage reportId={report.id} />);

    fireEvent.click(screen.getByRole('button', { name: 'Request changes' }));

    expect(
      screen.getByText('Add a comment before requesting changes.'),
    ).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('submits a trimmed comment when requesting changes', async () => {
    render(<ManagerReportReviewPage reportId={report.id} />);

    fireEvent.change(screen.getByLabelText(/Comment \(required/), {
      target: { value: '  Please clarify output.  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Request changes' }));

    expect(mutateAsync).toHaveBeenCalledWith({
      reportId: report.id,
      input: {
        action: 'CHANGES_REQUESTED',
        comment: 'Please clarify output.',
      },
    });
    await vi.waitFor(() => {
      expect(mutateAsync).toHaveReturned();
    });
  });

  it('submits approval without requiring a comment', () => {
    render(<ManagerReportReviewPage reportId={report.id} />);

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    expect(mutateAsync).toHaveBeenCalledWith({
      reportId: report.id,
      input: { action: 'APPROVED' },
    });
  });

  it('loads the selected historical snapshot and prevents reviewing it', () => {
    render(<ManagerReportReviewPage reportId={report.id} />);

    fireEvent.click(screen.getByRole('button', { name: 'View' }));

    expect(useReportVersion).toHaveBeenLastCalledWith(report.id, 1, true);
    expect(screen.getByText('Old task version')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Historical versions are read-only and cannot be reviewed.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Approve' }),
    ).not.toBeInTheDocument();
  });

  it('shows a conflict or server error from the review API', () => {
    useReviewReport.mockReturnValue({
      mutateAsync,
      reset,
      isPending: false,
      isError: true,
      isSuccess: false,
      error: new Error('Only submitted reports can be reviewed'),
    });
    render(<ManagerReportReviewPage reportId={report.id} />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Only submitted reports can be reviewed',
    );
  });
});
