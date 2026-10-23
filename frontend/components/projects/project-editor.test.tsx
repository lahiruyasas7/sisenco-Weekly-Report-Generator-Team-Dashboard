import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectEditor } from '@/components/projects/project-editor';

const {
  useAssignableMembers,
  useCreateProject,
  useProjectMembers,
  useReplaceProjectMembers,
  useUpdateProject,
  createMutateAsync,
  replaceMutateAsync,
} = vi.hoisted(() => ({
  useAssignableMembers: vi.fn(),
  useCreateProject: vi.fn(),
  useProjectMembers: vi.fn(),
  useReplaceProjectMembers: vi.fn(),
  useUpdateProject: vi.fn(),
  createMutateAsync: vi.fn(),
  replaceMutateAsync: vi.fn(),
}));

vi.mock('@/lib/hooks/use-projects', () => ({
  useAssignableMembers,
  useCreateProject,
  useProjectMembers,
  useReplaceProjectMembers,
  useUpdateProject,
}));

const createdProject = {
  id: 'project-1',
  name: 'Client A',
  description: null,
  color: '#0C7C72',
  isArchived: false,
  createdAt: '2026-10-22T00:00:00.000Z',
  updatedAt: '2026-10-22T00:00:00.000Z',
  isAssigned: false,
  memberCount: 0,
  reportCount: 0,
};

describe('ProjectEditor', () => {
  beforeEach(() => {
    useAssignableMembers.mockReturnValue({
      data: { data: [{ id: 'member-1', name: 'Nuwan Silva' }] },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    useProjectMembers.mockReturnValue({ isLoading: false, isError: false });
    useCreateProject.mockReturnValue({
      mutateAsync: createMutateAsync,
      isPending: false,
    });
    useUpdateProject.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
    useReplaceProjectMembers.mockReturnValue({
      mutateAsync: replaceMutateAsync,
      isPending: false,
      isError: false,
    });
    createMutateAsync.mockResolvedValue(createdProject);
    replaceMutateAsync.mockResolvedValue({
      projectId: createdProject.id,
      memberIds: ['member-1'],
    });
  });

  it('creates a project and replaces its assigned member list', async () => {
    const onSaved = vi.fn();
    render(
      <ProjectEditor project={null} onSaved={onSaved} onCancel={vi.fn()} />,
    );

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Client A' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Nuwan Silva' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save project' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(createMutateAsync).toHaveBeenCalledWith({
      name: 'Client A',
      description: null,
      color: '#0C7C72',
    });
    expect(replaceMutateAsync).toHaveBeenCalledWith({
      projectId: 'project-1',
      memberIds: ['member-1'],
    });
  });
});
