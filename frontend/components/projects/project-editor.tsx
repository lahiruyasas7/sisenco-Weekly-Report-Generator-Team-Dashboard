'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import {
  useAssignableMembers,
  useCreateProject,
  useProjectMembers,
  useReplaceProjectMembers,
  useUpdateProject,
} from '@/lib/hooks/use-projects';
import type { Project } from '@/lib/types';
import {
  projectSchema,
  type ProjectFormValues,
} from '@/lib/validators/projects';

const inputClass =
  'h-10 w-full rounded-md border border-[#c9ccc7] bg-white px-3 text-sm outline-none focus:border-[#0c7c72] focus:ring-2 focus:ring-[#0c7c72]/15';

export function ProjectEditor({
  project,
  onSaved,
  onCancel,
}: {
  project: Project | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const replaceMembers = useReplaceProjectMembers();
  const membersQuery = useAssignableMembers(true);
  const assignmentsQuery = useProjectMembers(project?.id, Boolean(project));
  const [memberIds, setMemberIds] = useState<string[] | null>(null);
  const [createdProject, setCreatedProject] = useState<Project | null>(null);
  const activeProject = project ?? createdProject;
  const selectedMemberIds = memberIds ?? assignmentsQuery.data?.memberIds ?? [];

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: project?.name ?? '',
      description: project?.description ?? '',
      color: project?.color ?? '#0C7C72',
    },
  });
  const selectedColor = useWatch({ control: form.control, name: 'color' });
  const serverError = form.formState.errors.root?.server?.message;
  const isSaving =
    createProject.isPending ||
    updateProject.isPending ||
    replaceMembers.isPending;

  async function onSubmit(values: ProjectFormValues) {
    form.clearErrors('root.server');
    try {
      let savedProject = activeProject;
      const input = {
        name: values.name,
        description: values.description || null,
        color: values.color || null,
      };
      if (savedProject) {
        await updateProject.mutateAsync({ projectId: savedProject.id, input });
      } else {
        savedProject = await createProject.mutateAsync(input);
        setCreatedProject(savedProject);
      }
      await replaceMembers.mutateAsync({
        projectId: savedProject.id,
        memberIds: selectedMemberIds,
      });
      onSaved();
    } catch (error) {
      form.setError('root.server', {
        type: 'server',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to save the project. Please try again.',
      });
    }
  }

  function toggleMember(memberId: string) {
    setMemberIds((current) => {
      const selected = current ?? assignmentsQuery.data?.memberIds ?? [];
      return selected.includes(memberId)
        ? selected.filter((id) => id !== memberId)
        : [...selected, memberId];
    });
  }

  return (
    <section
      className="rounded-xl border border-[#dedfdc] bg-white p-5"
      aria-labelledby="project-editor-heading"
    >
      <h2 id="project-editor-heading" className="text-base font-semibold">
        {project || createdProject
          ? `Edit: ${(project ?? createdProject)?.name}`
          : 'New project'}
      </h2>
      <form
        className="mt-4 space-y-4"
        noValidate
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <div className="space-y-1.5">
          <label
            htmlFor="project-name"
            className="block text-[13px] text-[#545f5b]"
          >
            Name
          </label>
          <input
            id="project-name"
            maxLength={120}
            aria-invalid={Boolean(form.formState.errors.name)}
            className={inputClass}
            {...form.register('name')}
          />
          {form.formState.errors.name?.message ? (
            <p className="text-xs text-red-700">
              {form.formState.errors.name.message}
            </p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <label
            htmlFor="project-description"
            className="block text-[13px] text-[#545f5b]"
          >
            Description
          </label>
          <textarea
            id="project-description"
            rows={2}
            maxLength={1000}
            className={`${inputClass} h-auto min-h-10 resize-y py-2`}
            {...form.register('description')}
          />
        </div>
        <div className="space-y-1.5">
          <label
            htmlFor="project-color"
            className="block text-[13px] text-[#545f5b]"
          >
            Color
          </label>
          <div className="flex gap-2">
            <input
              id="project-color"
              type="text"
              maxLength={7}
              aria-label="Project color hex value"
              className={inputClass}
              {...form.register('color')}
            />
            <input
              type="color"
              aria-label="Choose project color"
              value={selectedColor || '#0C7C72'}
              onChange={(event) =>
                form.setValue('color', event.currentTarget.value)
              }
              className="h-10 w-12 cursor-pointer rounded-md border border-[#c9ccc7] bg-white p-1"
            />
          </div>
          {form.formState.errors.color?.message ? (
            <p className="text-xs text-red-700">
              {form.formState.errors.color.message}
            </p>
          ) : null}
        </div>
        <fieldset className="space-y-2">
          <legend className="text-[13px] text-[#545f5b]">
            Assigned members
          </legend>
          {membersQuery.isLoading ? (
            <p className="text-sm text-[#66716d]" role="status">
              Loading members…
            </p>
          ) : membersQuery.isError ? (
            <div>
              <p className="text-sm text-red-700" role="alert">
                Unable to load active members.
              </p>
              <button
                type="button"
                onClick={() => void membersQuery.refetch()}
                className="mt-1 text-sm text-[#08796f] underline"
              >
                Try again
              </button>
            </div>
          ) : membersQuery.data?.data.length ? (
            <div className="max-h-52 space-y-2 overflow-y-auto">
              {membersQuery.data.data.map((member) => (
                <label
                  key={member.id}
                  className="flex items-center gap-2 text-sm text-[#38433e]"
                >
                  <input
                    type="checkbox"
                    checked={selectedMemberIds.includes(member.id)}
                    onChange={() => toggleMember(member.id)}
                    className="size-4 accent-[#0c7c72]"
                  />
                  {member.name}
                </label>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[#66716d]">
              No active members available.
            </p>
          )}
          {assignmentsQuery.isError ? (
            <div>
              <p className="text-sm text-red-700" role="alert">
                Unable to load this project’s current assignments.
              </p>
              <button
                type="button"
                onClick={() => void assignmentsQuery.refetch()}
                className="mt-1 text-sm text-[#08796f] underline"
              >
                Try again
              </button>
            </div>
          ) : null}
        </fieldset>
        {serverError ? (
          <p role="alert" className="text-sm text-red-700">
            {serverError}
          </p>
        ) : null}
        {createdProject && replaceMembers.isError ? (
          <p className="text-xs text-[#66716d]">
            The project was created, but its assignments were not saved. Retry
            to finish assigning members.
          </p>
        ) : null}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={
              isSaving ||
              membersQuery.isLoading ||
              membersQuery.isError ||
              assignmentsQuery.isLoading ||
              assignmentsQuery.isError
            }
            className="h-10 flex-1 rounded-md bg-[#0c7c72] px-4 text-sm font-semibold text-white hover:bg-[#096b62] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? 'Saving…' : 'Save project'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="h-10 rounded-md border border-[#d7dcd8] px-4 text-sm font-medium text-[#38433e] hover:bg-[#f6f7f5]"
          >
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}
