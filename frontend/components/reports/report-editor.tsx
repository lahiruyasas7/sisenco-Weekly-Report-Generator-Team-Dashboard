'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { memo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useFieldArray,
  useForm,
  useFormState,
  useWatch,
} from 'react-hook-form';
import type { Path, UseFormReturn } from 'react-hook-form';
import { useProjects } from '@/lib/hooks/use-projects';
import { useSubmitReport, useUpdateReport } from '@/lib/hooks/use-reports';
import type {
  Report,
  ReportPriority,
  ReportTaskStatus,
  ReportTaskType,
} from '@/lib/types';
import {
  reportDraftSchema,
  reportSubmitSchema,
  REPORT_ROW_LIMITS,
  type ReportFormValues,
} from '@/lib/validators/reports';

const inputClass =
  'h-10 w-full min-w-0 rounded-md border border-[#c9ccc7] bg-white px-3 text-sm outline-none focus:border-[#0c7c72] focus:ring-2 focus:ring-[#0c7c72]/15';
const selectClass = `${inputClass} px-2`;
const sectionClass = 'rounded-xl border border-[#dedfdc] bg-white p-5 sm:p-6';
const priorities: ReportPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const taskStatuses: ReportTaskStatus[] = [
  'COMPLETED',
  'IN_PROGRESS',
  'BLOCKED',
  'DEFERRED',
];
const taskTypes: ReportTaskType[] = [
  'DEVELOPMENT',
  'TESTING',
  'MEETINGS',
  'DOCUMENTATION',
  'DESIGN',
  'OTHER',
];

function ErrorText({ children }: { children?: string }) {
  return children ? <p className="text-xs text-red-700">{children}</p> : null;
}

function SectionHeading({
  title,
  onAdd,
  addLabel,
  disabled = false,
}: {
  title: string;
  onAdd?: () => void;
  addLabel?: string;
  disabled?: boolean;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-base font-semibold">{title}</h2>
      {onAdd && addLabel ? (
        <button
          type="button"
          onClick={onAdd}
          disabled={disabled}
          className="rounded-md border border-[#d7dcd8] px-3 py-2 text-xs font-medium text-[#245b53]"
        >
          {addLabel}
        </button>
      ) : null}
    </div>
  );
}

const LinksEditor = memo(function LinksEditor({
  control,
  register,
  setValue,
}: {
  control: UseFormReturn<ReportFormValues>['control'];
  register: UseFormReturn<ReportFormValues>['register'];
  setValue: UseFormReturn<ReportFormValues>['setValue'];
}) {
  const linkValues = useWatch({ control, name: 'links' }) ?? [];
  const { errors } = useFormState({ control, name: ['links', 'notes'] });

  return (
    <section className={sectionClass}>
      <SectionHeading title="7. Optional notes and links" />
      <label className="space-y-1 text-xs text-[#545f5b]">
        Notes
        <textarea
          rows={4}
          maxLength={5000}
          className={`${inputClass} h-auto resize-y py-2`}
          {...register('notes')}
        />
        <ErrorText>{errors.notes?.message}</ErrorText>
      </label>
      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-[#545f5b]">
            Links (up to {REPORT_ROW_LIMITS.links})
          </p>
          <button
            type="button"
            disabled={linkValues.length >= REPORT_ROW_LIMITS.links}
            onClick={() =>
              setValue('links', [...linkValues, ''], {
                shouldDirty: true,
              })
            }
            className="rounded-md border border-[#d7dcd8] px-3 py-2 text-xs font-medium disabled:opacity-50"
          >
            Add link
          </button>
        </div>
        <ErrorText>
          {errors.links?.message ?? errors.links?.root?.message}
        </ErrorText>
        {linkValues.map((_, index) => (
          <div key={`link-${index}`} className="flex gap-2">
            <input
              type="url"
              maxLength={2000}
              aria-label={`Link ${index + 1}`}
              className={inputClass}
              {...register(`links.${index}`)}
            />
            <button
              type="button"
              onClick={() =>
                setValue(
                  'links',
                  linkValues.filter((__, itemIndex) => itemIndex !== index),
                  { shouldDirty: true },
                )
              }
              className="px-2 text-xs font-medium text-red-700"
            >
              Remove
            </button>
          </div>
        ))}
        {linkValues.map((_, index) => (
          <ErrorText key={`link-error-${index}`}>
            {errors.links?.[index]?.message}
          </ErrorText>
        ))}
        {linkValues.length === 0 ? (
          <p className="text-xs text-[#66716d]">No links added.</p>
        ) : null}
      </div>
    </section>
  );
});

export function ReportEditor({ report }: { report: Report }) {
  const router = useRouter();
  const updateReport = useUpdateReport();
  const submitReport = useSubmitReport();
  const projectsQuery = useProjects({
    page: 1,
    limit: 100,
    includeArchived: true,
  });
  const form = useForm<ReportFormValues>({
    resolver: zodResolver(reportDraftSchema),
    defaultValues: {
      projectId: report.content.project?.id ?? '',
      tasks: report.content.tasks.map((task) => ({ ...task })),
      nextWeekTasks: report.content.nextWeekTasks.map((task) => ({ ...task })),
      blockers: report.content.blockers.map((blocker) => ({ ...blocker })),
      achievements: report.content.achievements.map((achievement) => ({
        ...achievement,
      })),
      timeEntries: report.content.timeEntries.map((entry) => ({ ...entry })),
      notes: report.content.notes,
      links: [...report.content.links],
    },
  });
  const tasks = useFieldArray({ control: form.control, name: 'tasks' });
  const nextWeekTasks = useFieldArray({
    control: form.control,
    name: 'nextWeekTasks',
  });
  const blockers = useFieldArray({ control: form.control, name: 'blockers' });
  const achievements = useFieldArray({
    control: form.control,
    name: 'achievements',
  });
  const timeEntries = useFieldArray({
    control: form.control,
    name: 'timeEntries',
  });
  const active =
    report.status === 'DRAFT' || report.status === 'NEEDS_CORRECTION';
  const isSaving = updateReport.isPending || submitReport.isPending;
  const serverError = form.formState.errors.root?.server?.message;
  const projects = projectsQuery.data?.data ?? [];
  const selectedProject = report.content.project;
  const selectedProjectArchived = Boolean(
    selectedProject &&
      projects.find((project) => project.id === selectedProject.id)?.isArchived,
  );

  function apiInput(values: ReportFormValues) {
    return {
      ...values,
      projectId: values.projectId || null,
      notes: values.notes || null,
    };
  }

  async function saveDraft(values: ReportFormValues) {
    form.clearErrors('root.server');
    try {
      await updateReport.mutateAsync({
        reportId: report.id,
        input: apiInput(values),
      });
      router.push(`/reports/${encodeURIComponent(report.id)}`);
    } catch (error) {
      form.setError('root.server', {
        type: 'server',
        message:
          error instanceof Error ? error.message : 'Unable to save this draft.',
      });
    }
  }

  async function submitForReview(values: ReportFormValues) {
    form.clearErrors('root.server');
    const validated = reportSubmitSchema.safeParse(values);
    if (!validated.success) {
      for (const issue of validated.error.issues) {
        form.setError(issue.path.join('.') as Path<ReportFormValues>, {
          type: 'validate',
          message: issue.message,
        });
      }
      return;
    }
    try {
      await updateReport.mutateAsync({
        reportId: report.id,
        input: apiInput(validated.data),
      });
      await submitReport.mutateAsync(report.id);
      router.push(`/reports/${encodeURIComponent(report.id)}`);
    } catch (error) {
      form.setError('root.server', {
        type: 'server',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to submit this report.',
      });
    }
  }

  if (!active) {
    return (
      <div className="rounded-xl border border-[#dedfdc] bg-white p-6">
        <p className="text-sm text-[#66716d]">
          This report is locked and can’t be edited.
        </p>
        <Link
          href={`/reports/${encodeURIComponent(report.id)}`}
          className="mt-3 inline-flex text-sm font-medium text-[#08796f] underline"
        >
          View report
        </Link>
      </div>
    );
  }

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={form.handleSubmit(saveDraft)}
    >
      {report.status === 'NEEDS_CORRECTION' && report.latestReview?.comment ? (
        <aside
          className="rounded-xl border border-[#eacb9f] bg-[#fff8eb] p-5"
          aria-label="Manager correction comment"
        >
          <h2 className="text-sm font-semibold text-[#74400c]">
            Manager requested changes
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-[#49331b]">
            {report.latestReview.comment}
          </p>
          <p className="mt-2 text-xs text-[#795a36]">
            From {report.latestReview.reviewer.name}
          </p>
        </aside>
      ) : null}
      {serverError ? (
        <p
          className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700"
          role="alert"
        >
          {serverError}
        </p>
      ) : null}

      <section className={sectionClass}>
        <SectionHeading title="1. Week and project" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-[#66716d]">Report week</p>
            <p className="mt-1 text-sm font-medium">
              {report.content.weekStart} – {report.content.weekEnd}
            </p>
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="edit-project"
              className="block text-[13px] text-[#545f5b]"
            >
              Project{' '}
              <span className="text-[#66716d]">(required to submit)</span>
            </label>
            {projectsQuery.isError ? (
              <p className="text-xs text-red-700" role="alert">
                Unable to load projects.{' '}
                <button
                  type="button"
                  onClick={() => void projectsQuery.refetch()}
                  className="underline"
                >
                  Try again
                </button>
              </p>
            ) : (
              <select
                id="edit-project"
                className={selectClass}
                disabled={projectsQuery.isLoading}
                aria-invalid={Boolean(form.formState.errors.projectId)}
                {...form.register('projectId')}
              >
                <option value="">Choose a project</option>
                {selectedProjectArchived ? (
                  <option value={selectedProject?.id}>
                    {selectedProject?.name} (archived — choose an active
                    project)
                  </option>
                ) : null}
                {projects
                  .filter((project) => !project.isArchived)
                  .map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
              </select>
            )}
            <ErrorText>{form.formState.errors.projectId?.message}</ErrorText>
          </div>
        </div>
      </section>

      <section className={sectionClass}>
        <SectionHeading
          title={`2. Tasks completed (up to ${REPORT_ROW_LIMITS.tasks})`}
          onAdd={() =>
            tasks.append({
              name: '',
              priority: 'MEDIUM',
              plannedPercent: 0,
              actualPercent: 0,
              status: 'IN_PROGRESS',
              plannedHours: 0,
              spentHours: 0,
              output: '',
            })
          }
          disabled={tasks.fields.length >= REPORT_ROW_LIMITS.tasks}
          addLabel="Add task"
        />
        <ErrorText>
          {form.formState.errors.tasks?.message ??
            form.formState.errors.tasks?.root?.message}
        </ErrorText>
        <div className="space-y-4">
          {tasks.fields.map((field, index) => (
            <fieldset
              key={field.id}
              className="grid gap-3 rounded-lg border border-[#eceeeb] p-3 sm:grid-cols-2 lg:grid-cols-4"
            >
              <legend className="sr-only">Task {index + 1}</legend>
              <label className="space-y-1 text-xs text-[#545f5b] lg:col-span-2">
                Task name
                <input
                  maxLength={200}
                  className={inputClass}
                  {...form.register(`tasks.${index}.name`)}
                />
                <ErrorText>
                  {form.formState.errors.tasks?.[index]?.name?.message}
                </ErrorText>
              </label>
              <label className="space-y-1 text-xs text-[#545f5b]">
                Priority
                <select
                  className={selectClass}
                  {...form.register(`tasks.${index}.priority`)}
                >
                  {priorities.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs text-[#545f5b]">
                Status
                <select
                  className={selectClass}
                  {...form.register(`tasks.${index}.status`)}
                >
                  {taskStatuses.map((value) => (
                    <option key={value} value={value}>
                      {value.replaceAll('_', ' ')}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs text-[#545f5b]">
                Planned %
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  className={inputClass}
                  {...form.register(`tasks.${index}.plannedPercent`, {
                    valueAsNumber: true,
                  })}
                />
              </label>
              <label className="space-y-1 text-xs text-[#545f5b]">
                Actual %
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  className={inputClass}
                  {...form.register(`tasks.${index}.actualPercent`, {
                    valueAsNumber: true,
                  })}
                />
              </label>
              <label className="space-y-1 text-xs text-[#545f5b]">
                Hours planned
                <input
                  type="number"
                  min={0}
                  step="0.25"
                  className={inputClass}
                  {...form.register(`tasks.${index}.plannedHours`, {
                    valueAsNumber: true,
                  })}
                />
              </label>
              <label className="space-y-1 text-xs text-[#545f5b]">
                Hours spent
                <input
                  type="number"
                  min={0}
                  step="0.25"
                  className={inputClass}
                  {...form.register(`tasks.${index}.spentHours`, {
                    valueAsNumber: true,
                  })}
                />
              </label>
              <label className="space-y-1 text-xs text-[#545f5b] sm:col-span-2 lg:col-span-3">
                Output / deliverable
                <input
                  maxLength={1000}
                  className={inputClass}
                  {...form.register(`tasks.${index}.output`)}
                />
              </label>
              <div className="flex items-end justify-end">
                <button
                  type="button"
                  onClick={() => tasks.remove(index)}
                  className="h-10 px-2 text-xs font-medium text-red-700"
                >
                  Remove task
                </button>
              </div>
            </fieldset>
          ))}
          {tasks.fields.length === 0 ? (
            <p className="text-sm text-[#66716d]">
              No tasks yet. Add a task to start your report.
            </p>
          ) : null}
        </div>
      </section>

      <section className={sectionClass}>
        <SectionHeading
          title={`3. Tasks planned for next week (up to ${REPORT_ROW_LIMITS.nextWeekTasks})`}
          onAdd={() =>
            nextWeekTasks.append({
              description: '',
              priority: 'MEDIUM',
              estimatedHours: null,
            })
          }
          disabled={
            nextWeekTasks.fields.length >= REPORT_ROW_LIMITS.nextWeekTasks
          }
          addLabel="Add next-week task"
        />
        <ErrorText>
          {form.formState.errors.nextWeekTasks?.message ??
            form.formState.errors.nextWeekTasks?.root?.message}
        </ErrorText>
        <div className="space-y-3">
          {nextWeekTasks.fields.map((field, index) => (
            <div
              key={field.id}
              className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px_140px_auto]"
            >
              <label className="space-y-1 text-xs text-[#545f5b]">
                Description
                <input
                  maxLength={1000}
                  className={inputClass}
                  {...form.register(`nextWeekTasks.${index}.description`)}
                />
                <ErrorText>
                  {
                    form.formState.errors.nextWeekTasks?.[index]?.description
                      ?.message
                  }
                </ErrorText>
              </label>
              <label className="space-y-1 text-xs text-[#545f5b]">
                Priority
                <select
                  className={selectClass}
                  {...form.register(`nextWeekTasks.${index}.priority`)}
                >
                  {priorities.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs text-[#545f5b]">
                Estimated hours
                <input
                  type="number"
                  min={0}
                  step="0.25"
                  className={inputClass}
                  {...form.register(`nextWeekTasks.${index}.estimatedHours`, {
                    setValueAs: (value: string) =>
                      value === '' ? null : Number(value),
                  })}
                />
              </label>
              <button
                type="button"
                onClick={() => nextWeekTasks.remove(index)}
                className="self-end px-2 py-3 text-xs font-medium text-red-700"
              >
                Remove
              </button>
            </div>
          ))}
          {nextWeekTasks.fields.length === 0 ? (
            <p className="text-sm text-[#66716d]">No next-week tasks added.</p>
          ) : null}
        </div>
      </section>

      <section className={sectionClass}>
        <SectionHeading
          title={`4. Blockers and challenges (up to ${REPORT_ROW_LIMITS.blockers})`}
          onAdd={() =>
            blockers.append({
              description: '',
              isKey: false,
              isResolved: false,
            })
          }
          disabled={blockers.fields.length >= REPORT_ROW_LIMITS.blockers}
          addLabel="Add blocker"
        />
        <ErrorText>
          {form.formState.errors.blockers?.message ??
            form.formState.errors.blockers?.root?.message}
        </ErrorText>
        <div className="space-y-3">
          {blockers.fields.map((field, index) => (
            <div
              key={field.id}
              className="grid gap-2 rounded-lg border border-[#eceeeb] p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-end"
            >
              <label className="space-y-1 text-xs text-[#545f5b]">
                Description
                <input
                  maxLength={1000}
                  className={inputClass}
                  {...form.register(`blockers.${index}.description`)}
                />
                <ErrorText>
                  {
                    form.formState.errors.blockers?.[index]?.description
                      ?.message
                  }
                </ErrorText>
              </label>
              <label className="flex h-10 items-center gap-2 text-xs text-[#545f5b]">
                <input
                  type="checkbox"
                  className="size-4 accent-[#0c7c72]"
                  {...form.register(`blockers.${index}.isKey`)}
                />{' '}
                Key issue
              </label>
              <label className="flex h-10 items-center gap-2 text-xs text-[#545f5b]">
                <input
                  type="checkbox"
                  className="size-4 accent-[#0c7c72]"
                  {...form.register(`blockers.${index}.isResolved`)}
                />{' '}
                Resolved
              </label>
              <button
                type="button"
                onClick={() => blockers.remove(index)}
                className="h-10 px-2 text-xs font-medium text-red-700"
              >
                Remove
              </button>
            </div>
          ))}
          {blockers.fields.length === 0 ? (
            <p className="text-sm text-[#66716d]">No blockers added.</p>
          ) : null}
        </div>
      </section>

      <section className={sectionClass}>
        <SectionHeading
          title={`5. Achievements and highlights (up to ${REPORT_ROW_LIMITS.achievements})`}
          onAdd={() => achievements.append({ description: '', isKey: false })}
          disabled={
            achievements.fields.length >= REPORT_ROW_LIMITS.achievements
          }
          addLabel="Add achievement"
        />
        <ErrorText>
          {form.formState.errors.achievements?.message ??
            form.formState.errors.achievements?.root?.message}
        </ErrorText>
        <div className="space-y-3">
          {achievements.fields.map((field, index) => (
            <div
              key={field.id}
              className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end"
            >
              <label className="space-y-1 text-xs text-[#545f5b]">
                Description
                <input
                  maxLength={1000}
                  className={inputClass}
                  {...form.register(`achievements.${index}.description`)}
                />
                <ErrorText>
                  {
                    form.formState.errors.achievements?.[index]?.description
                      ?.message
                  }
                </ErrorText>
              </label>
              <label className="flex h-10 items-center gap-2 text-xs text-[#545f5b]">
                <input
                  type="checkbox"
                  className="size-4 accent-[#0c7c72]"
                  {...form.register(`achievements.${index}.isKey`)}
                />{' '}
                Key achievement
              </label>
              <button
                type="button"
                onClick={() => achievements.remove(index)}
                className="h-10 px-2 text-xs font-medium text-red-700"
              >
                Remove
              </button>
            </div>
          ))}
          {achievements.fields.length === 0 ? (
            <p className="text-sm text-[#66716d]">No achievements added.</p>
          ) : null}
        </div>
      </section>

      <section className={sectionClass}>
        <SectionHeading
          title={`6. Hours worked by task type (up to ${REPORT_ROW_LIMITS.timeEntries})`}
          onAdd={() =>
            timeEntries.append({ taskType: 'DEVELOPMENT', hours: 0 })
          }
          disabled={timeEntries.fields.length >= REPORT_ROW_LIMITS.timeEntries}
          addLabel="Add hours"
        />
        <ErrorText>
          {form.formState.errors.timeEntries?.message ??
            form.formState.errors.timeEntries?.root?.message}
        </ErrorText>
        <div className="space-y-3">
          {timeEntries.fields.map((field, index) => (
            <div
              key={field.id}
              className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px_auto]"
            >
              <label className="space-y-1 text-xs text-[#545f5b]">
                Task type
                <select
                  className={selectClass}
                  {...form.register(`timeEntries.${index}.taskType`)}
                >
                  {taskTypes.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs text-[#545f5b]">
                Hours
                <input
                  type="number"
                  min={0}
                  step="0.25"
                  className={inputClass}
                  {...form.register(`timeEntries.${index}.hours`, {
                    valueAsNumber: true,
                  })}
                />
              </label>
              <button
                type="button"
                onClick={() => timeEntries.remove(index)}
                className="h-10 px-2 text-xs font-medium text-red-700"
              >
                Remove
              </button>
            </div>
          ))}
          {timeEntries.fields.length === 0 ? (
            <p className="text-sm text-[#66716d]">
              Hours by task type are optional.
            </p>
          ) : null}
        </div>
      </section>

      <LinksEditor
        control={form.control}
        register={form.register}
        setValue={form.setValue}
      />

      <footer className="sticky bottom-0 flex flex-wrap justify-end gap-2 rounded-xl border border-[#dedfdc] bg-white/95 p-3 shadow-sm backdrop-blur">
        <Link
          href={`/reports/${encodeURIComponent(report.id)}`}
          className="inline-flex h-9 items-center rounded-md border border-[#d7dcd8] px-4 text-sm"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isSaving}
          className="h-9 rounded-md border border-[#0c7c72] px-4 text-sm font-semibold text-[#0c7c72] disabled:opacity-60"
        >
          {updateReport.isPending ? 'Saving…' : 'Save draft'}
        </button>
        <button
          type="button"
          disabled={isSaving}
          onClick={() => void form.handleSubmit(submitForReview)()}
          className="h-9 rounded-md bg-[#0c7c72] px-4 text-sm font-semibold text-white disabled:opacity-60"
        >
          {submitReport.isPending ? 'Submitting…' : 'Submit for review'}
        </button>
      </footer>
    </form>
  );
}
