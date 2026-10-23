import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectsPage } from '@/components/projects/projects-page';

const { useCurrentUser, useProjects, useUpdateProject, useDeleteProject } =
  vi.hoisted(() => ({
    useCurrentUser: vi.fn(),
    useProjects: vi.fn(),
    useUpdateProject: vi.fn(),
    useDeleteProject: vi.fn(),
  }));

vi.mock('@/lib/hooks/use-auth', () => ({ useCurrentUser }));
vi.mock('@/lib/hooks/use-projects', () => ({
  useProjects,
  useUpdateProject,
  useDeleteProject,
}));

const project = {
  id: 'project-1',
  name: 'Client A',
  description: 'Retail platform build',
  color: '#0C7C72',
  isArchived: false,
  createdAt: '2026-10-22T00:00:00.000Z',
  updatedAt: '2026-10-22T00:00:00.000Z',
  isAssigned: true,
  memberCount: 3,
  reportCount: 18,
};

describe('ProjectsPage', () => {
  beforeEach(() => {
    useCurrentUser.mockReturnValue({ data: { role: 'MEMBER' } });
    useProjects.mockReturnValue({
      data: {
        data: [project],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      },
      isError: false,
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
    });
    useUpdateProject.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
    useDeleteProject.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
  });

  it('lets members browse projects without management controls', () => {
    render(<ProjectsPage />);

    expect(
      screen.getByRole('heading', { name: 'Projects' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Client A')).toBeInTheDocument();
    expect(screen.getByText('Retail platform build')).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'New project' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Edit' }),
    ).not.toBeInTheDocument();
  });

  it('shows project management and archived filtering to managers', () => {
    useCurrentUser.mockReturnValue({ data: { role: 'MANAGER' } });
    render(<ProjectsPage />);

    expect(
      screen.getByRole('button', { name: 'New project' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: 'Include archived' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Archive' })).toBeInTheDocument();
  });

  it('shows a retry action when the project list fails', () => {
    const refetch = vi.fn();
    useProjects.mockReturnValue({
      data: undefined,
      isError: true,
      isLoading: false,
      refetch,
    });
    render(<ProjectsPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalledOnce();
  });
});
