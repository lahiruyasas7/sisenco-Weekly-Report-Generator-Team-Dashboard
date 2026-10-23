import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReportEditor } from '@/components/reports/report-editor';
import type { Report } from '@/lib/types';

const { useProjects, useSubmitReport, useUpdateReport, routerPush } =
  vi.hoisted(() => ({
    useProjects: vi.fn(),
    useSubmitReport: vi.fn(),
    useUpdateReport: vi.fn(),
    routerPush: vi.fn(),
  }));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: routerPush }) }));
vi.mock('@/lib/hooks/use-projects', () => ({ useProjects }));
vi.mock('@/lib/hooks/use-reports', () => ({
  useSubmitReport,
  useUpdateReport,
}));

const report: Report = {
  id: 'report-1',
  user: { id: 'member-1', name: 'Member One' },
  status: 'NEEDS_CORRECTION',
  currentVersion: 1,
  submittedAt: '2026-10-20T12:00:00.000Z',
  firstSubmittedAt: '2026-10-20T12:00:00.000Z',
  reviewedAt: '2026-10-21T12:00:00.000Z',
  latestReview: {
    action: 'CHANGES_REQUESTED',
    comment: 'Please add the output delivered.',
    createdAt: '2026-10-21T12:00:00.000Z',
    reviewer: { id: 'manager-1', name: 'Manager One' },
  },
  content: {
    weekStart: '2026-10-19',
    weekEnd: '2026-10-25',
    project: null,
    tasks: [],
    nextWeekTasks: [],
    blockers: [],
    achievements: [],
    timeEntries: [],
    notes: '',
    links: [],
  },
};

describe('ReportEditor', () => {
  const updateAsync = vi.fn();
  const submitAsync = vi.fn();

  beforeEach(() => {
    useProjects.mockReturnValue({
      data: { data: [] },
      isLoading: false,
      isError: false,
    });
    updateAsync.mockReset();
    submitAsync.mockReset();
    useUpdateReport.mockReturnValue({
      mutateAsync: updateAsync,
      isPending: false,
    });
    useSubmitReport.mockReturnValue({
      mutateAsync: submitAsync,
      isPending: false,
    });
    routerPush.mockReset();
  });

  it('renders the shared fixed sections and correction comment', () => {
    render(<ReportEditor report={report} />);

    expect(
      screen.getByText('Please add the output delivered.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '2. Tasks completed' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '3. Tasks planned for next week' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '4. Blockers and challenges' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '5. Achievements and highlights' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '6. Hours worked by task type' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '7. Optional notes and links' }),
    ).toBeInTheDocument();
  });

  it('blocks submit until required project and report content are complete', async () => {
    render(<ReportEditor report={report} />);
    fireEvent.click(screen.getByRole('button', { name: 'Submit for review' }));

    expect(
      await screen.findByText('Choose a project before submitting.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Add at least one task before submitting.'),
    ).toBeInTheDocument();
    expect(updateAsync).not.toHaveBeenCalled();
    expect(submitAsync).not.toHaveBeenCalled();
  });
});
