'use client';

import { useState } from 'react';
import { ProjectEditor } from '@/components/projects/project-editor';
import { useCurrentUser } from '@/lib/hooks/use-auth';
import {
  useDeleteProject,
  useProjects,
  useUpdateProject,
} from '@/lib/hooks/use-projects';
import type { Project } from '@/lib/types';

const PAGE_SIZE = 20;

export function ProjectsPage() {
  const currentUser = useCurrentUser();
  const role = currentUser.data?.role;
  const canManage = role === 'MANAGER' || role === 'ADMIN';
  const [includeArchived, setIncludeArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState<Project | null | undefined>(undefined);
  const [confirmDelete, setConfirmDelete] = useState<Project | null>(null);
  const [actionError, setActionError] = useState('');
  const projectsQuery = useProjects({
    page,
    limit: PAGE_SIZE,
    includeArchived: canManage && includeArchived,
  });
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const projects = projectsQuery.data?.data ?? [];
  const meta = projectsQuery.data?.meta;

  async function toggleArchive(project: Project) {
    setActionError('');
    try {
      await updateProject.mutateAsync({
        projectId: project.id,
        input: { isArchived: !project.isArchived },
      });
      if (projects.length === 1 && page > 1) setPage((current) => current - 1);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Unable to update the project.',
      );
    }
  }

  async function removeProject() {
    if (!confirmDelete) return;
    setActionError('');
    try {
      await deleteProject.mutateAsync(confirmDelete.id);
      setConfirmDelete(null);
      if (projects.length === 1 && page > 1) setPage((current) => current - 1);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Unable to delete the project.',
      );
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="mt-1 text-sm text-[#66716d]">
            Tags used on weekly reports.
          </p>
        </div>
        {canManage ? (
          <button
            type="button"
            onClick={() => setEditor(null)}
            className="h-9 rounded-md bg-[#0c7c72] px-4 text-sm font-semibold text-white hover:bg-[#096b62] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0c7c72]"
          >
            New project
          </button>
        ) : null}
      </header>

      {actionError ? (
        <p
          className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700"
          role="alert"
        >
          {actionError}
        </p>
      ) : null}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(310px,1fr)]">
        <section
          className="overflow-hidden rounded-xl border border-[#dedfdc] bg-white"
          aria-label="Projects list"
        >
          {canManage ? (
            <div className="flex items-center justify-between gap-3 border-b border-[#eceeeb] px-5 py-3">
              <p className="text-sm font-medium text-[#38433e]">
                Browse projects
              </p>
              <label className="flex items-center gap-2 text-xs text-[#545f5b]">
                <input
                  type="checkbox"
                  checked={includeArchived}
                  onChange={(event) => {
                    setIncludeArchived(event.currentTarget.checked);
                    setPage(1);
                  }}
                  className="size-4 accent-[#0c7c72]"
                />
                Include archived
              </label>
            </div>
          ) : null}
          {projectsQuery.isError ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-red-700" role="alert">
                We couldn’t load projects. Please try again.
              </p>
              <button
                type="button"
                onClick={() => void projectsQuery.refetch()}
                className="mt-3 text-sm font-medium text-[#08796f] underline underline-offset-2"
              >
                Try again
              </button>
            </div>
          ) : projectsQuery.isLoading ? (
            <p
              className="px-6 py-12 text-center text-sm text-[#66716d]"
              role="status"
            >
              Loading projects…
            </p>
          ) : projects.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm font-medium text-[#38433e]">
                {includeArchived
                  ? 'No projects found.'
                  : 'No active projects yet.'}
              </p>
              {canManage ? (
                <p className="mt-1 text-sm text-[#66716d]">
                  Create a project to make it available for weekly reports.
                </p>
              ) : null}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] border-collapse text-left text-sm">
                  <thead className="text-xs text-[#58635f]">
                    <tr className="border-b border-[#dedfdc]">
                      <th scope="col" className="px-5 py-3 font-semibold">
                        Project
                      </th>
                      <th scope="col" className="px-3 py-3 font-semibold">
                        Members
                      </th>
                      <th scope="col" className="px-3 py-3 font-semibold">
                        Reports
                      </th>
                      <th scope="col" className="px-3 py-3 font-semibold">
                        Status
                      </th>
                      {canManage ? (
                        <th
                          scope="col"
                          className="px-5 py-3 text-right font-semibold"
                        >
                          Actions
                        </th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eceeeb]">
                    {projects.map((project) => (
                      <tr key={project.id}>
                        <td className="px-5 py-3">
                          <div className="flex items-start gap-2">
                            <span
                              aria-hidden="true"
                              className="mt-1.5 size-2 shrink-0 rounded-full"
                              style={{
                                backgroundColor: project.color ?? '#66716d',
                              }}
                            />
                            <div className="min-w-0">
                              <p className="font-medium text-[#202623]">
                                {project.name}
                              </p>
                              {project.description ? (
                                <p className="mt-0.5 max-w-xs truncate text-xs text-[#66716d]">
                                  {project.description}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-[#38433e]">
                          {project.memberCount}
                        </td>
                        <td className="px-3 py-3 text-[#38433e]">
                          {project.reportCount}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${project.isArchived ? 'bg-[#e8eaed] text-[#4b5563]' : 'bg-[#d4f1e6] text-[#17654e]'}`}
                          >
                            {project.isArchived ? 'Archived' : 'Active'}
                          </span>
                        </td>
                        {canManage ? (
                          <td className="px-5 py-3 text-right">
                            {confirmDelete?.id === project.id ? (
                              <div
                                className="space-y-2 text-left"
                                role="group"
                                aria-label={`Confirm delete ${project.name}`}
                              >
                                <p className="text-xs text-[#66716d]">
                                  Delete this project? Projects used by reports
                                  must be archived.
                                </p>
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDelete(null)}
                                    className="rounded-md border border-[#d7dcd8] px-2.5 py-1.5 text-xs"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    disabled={deleteProject.isPending}
                                    onClick={() => void removeProject()}
                                    className="rounded-md bg-red-700 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                                  >
                                    {deleteProject.isPending
                                      ? 'Deleting…'
                                      : 'Confirm delete'}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex justify-end gap-2 whitespace-nowrap text-sm">
                                <button
                                  type="button"
                                  onClick={() => setEditor(project)}
                                  className="font-medium text-[#08796f] hover:underline"
                                >
                                  Edit
                                </button>
                                <span className="text-[#98a19d]">·</span>
                                {project.isArchived ? (
                                  <button
                                    type="button"
                                    disabled={updateProject.isPending}
                                    onClick={() => void toggleArchive(project)}
                                    className="font-medium text-[#08796f] hover:underline disabled:opacity-50"
                                  >
                                    Restore
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={updateProject.isPending}
                                    onClick={() => void toggleArchive(project)}
                                    className="font-medium text-[#08796f] hover:underline disabled:opacity-50"
                                  >
                                    Archive
                                  </button>
                                )}
                                {project.isArchived &&
                                project.reportCount === 0 ? (
                                  <>
                                    <span className="text-[#98a19d]">·</span>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDelete(project)}
                                      className="font-medium text-[#08796f] hover:underline"
                                    >
                                      Delete
                                    </button>
                                  </>
                                ) : null}
                              </div>
                            )}
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {canManage &&
              projects.some((project) => project.reportCount > 0) ? (
                <p className="border-t border-[#eceeeb] px-5 py-3 text-xs text-[#66716d]">
                  Projects with reports can be archived but not deleted.
                </p>
              ) : null}
              <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#eceeeb] px-5 py-3">
                <p className="text-xs text-[#66716d]">
                  {meta?.total ?? projects.length} project
                  {(meta?.total ?? projects.length) === 1 ? '' : 's'}
                  {meta
                    ? ` · Page ${meta.page} of ${Math.max(meta.totalPages, 1)}`
                    : ''}
                </p>
                {meta && meta.totalPages > 1 ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={page <= 1 || projectsQuery.isFetching}
                      onClick={() => setPage((current) => current - 1)}
                      className="rounded-md border border-[#d7dcd8] px-3 py-2 text-sm disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={
                        page >= meta.totalPages || projectsQuery.isFetching
                      }
                      onClick={() => setPage((current) => current + 1)}
                      className="rounded-md border border-[#d7dcd8] px-3 py-2 text-sm disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                ) : null}
              </footer>
            </>
          )}
        </section>

        {canManage && editor !== undefined ? (
          <ProjectEditor
            key={editor?.id ?? 'new-project'}
            project={editor}
            onSaved={() => setEditor(undefined)}
            onCancel={() => setEditor(undefined)}
          />
        ) : null}
      </div>
    </div>
  );
}
