'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useProjects } from '@/lib/hooks/use-projects';
import { useCreateReport } from '@/lib/hooks/use-reports';
import { getCurrentWeekStart } from '@/lib/week';
import {
  createReportSchema,
  type CreateReportValues,
} from '@/lib/validators/reports';

const inputClass =
  'h-10 w-full rounded-md border border-[#c9ccc7] bg-white px-3 text-sm outline-none focus:border-[#0c7c72] focus:ring-2 focus:ring-[#0c7c72]/15';

export function NewReportPage() {
  const router = useRouter();
  const projectsQuery = useProjects({ page: 1, limit: 100 });
  const createReport = useCreateReport();
  const form = useForm<CreateReportValues>({
    resolver: zodResolver(createReportSchema),
    defaultValues: { weekStart: getCurrentWeekStart(), projectId: '' },
  });
  const [submitError, setSubmitError] = useState('');
  const projects = projectsQuery.data?.data ?? [];

  async function onSubmit(values: CreateReportValues) {
    setSubmitError('');
    try {
      const report = await createReport.mutateAsync({
        weekStart: values.weekStart,
        ...(values.projectId ? { projectId: values.projectId } : {}),
      });
      router.push(`/reports/${encodeURIComponent(report.id)}/edit`);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : 'Unable to create this report.',
      );
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Start a weekly report
        </h1>
        <p className="mt-1 text-sm text-[#66716d]">
          Choose the week and project. You can finish the report after saving
          this draft.
        </p>
      </header>
      <form
        className="space-y-5 rounded-xl border border-[#dedfdc] bg-white p-5 sm:p-6"
        noValidate
        onSubmit={form.handleSubmit(onSubmit)}
      >
        {submitError ? (
          <p
            className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            {submitError}
          </p>
        ) : null}
        <div className="space-y-1.5">
          <label
            htmlFor="report-week-start"
            className="block text-[13px] text-[#545f5b]"
          >
            Week starting Monday
          </label>
          <input
            id="report-week-start"
            type="date"
            className={inputClass}
            aria-invalid={Boolean(form.formState.errors.weekStart)}
            {...form.register('weekStart')}
          />
          {form.formState.errors.weekStart?.message ? (
            <p className="text-xs text-red-700">
              {form.formState.errors.weekStart.message}
            </p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <label
            htmlFor="report-project"
            className="block text-[13px] text-[#545f5b]"
          >
            Project{' '}
            <span className="text-[#66716d]">(optional for drafts)</span>
          </label>
          {projectsQuery.isError ? (
            <div className="space-y-2">
              <p className="text-xs text-red-700" role="alert">
                Unable to load projects.
              </p>
              <button
                type="button"
                onClick={() => void projectsQuery.refetch()}
                className="text-sm font-medium text-[#08796f] underline"
              >
                Try again
              </button>
            </div>
          ) : (
            <select
              id="report-project"
              className={inputClass}
              disabled={projectsQuery.isLoading}
              {...form.register('projectId')}
            >
              <option value="">Choose later</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          )}
          {projectsQuery.isLoading ? (
            <p className="text-xs text-[#66716d]" role="status">
              Loading projects…
            </p>
          ) : null}
        </div>
        {projectsQuery.isSuccess && projects.length === 0 ? (
          <p className="text-sm text-[#66716d]">
            No active projects are available yet. You can still save the draft
            and choose a project before submitting.
          </p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="h-9 rounded-md border border-[#d7dcd8] px-4 text-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createReport.isPending || projectsQuery.isLoading}
            className="h-9 rounded-md bg-[#0c7c72] px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            {createReport.isPending ? 'Creating…' : 'Create draft'}
          </button>
        </div>
      </form>
    </div>
  );
}
