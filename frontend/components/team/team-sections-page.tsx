'use client';

import Link from 'next/link';
import { useState } from 'react';
import { WeekPicker } from '@/components/team/week-picker';
import { useTeamSection } from '@/lib/hooks/use-team';
import type {
  TeamSection,
  TeamSectionContent,
  TeamSectionItem,
} from '@/lib/types';
import { getCurrentWeekStart } from '@/lib/week';

const SECTION_OPTIONS: { value: TeamSection; label: string }[] = [
  { value: 'blockers', label: 'Blockers' },
  { value: 'achievements', label: 'Achievements' },
  { value: 'nextWeek', label: 'Next week' },
  { value: 'notes', label: 'Notes' },
];

function isBlockers(
  content: TeamSectionContent,
): content is Extract<TeamSectionContent, { isResolved: boolean }[]> {
  return (
    Array.isArray(content) &&
    content.every(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        'isResolved' in item &&
        'isKey' in item,
    )
  );
}

function isAchievements(
  content: TeamSectionContent,
): content is Extract<TeamSectionContent, { isKey: boolean }[]> {
  return (
    Array.isArray(content) &&
    content.every(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        'isKey' in item &&
        !('isResolved' in item),
    )
  );
}

function isNextWeekTasks(
  content: TeamSectionContent,
): content is Extract<TeamSectionContent, { estimatedHours: number | null }[]> {
  return (
    Array.isArray(content) &&
    content.every(
      (item) =>
        typeof item === 'object' && item !== null && 'estimatedHours' in item,
    )
  );
}

function renderContent(section: TeamSection, item: TeamSectionItem) {
  if (section === 'notes') {
    return typeof item.content === 'string' && item.content.trim() ? (
      <p className="whitespace-pre-wrap text-sm leading-6 text-[#38433e]">
        {item.content}
      </p>
    ) : (
      <p className="text-sm text-[#87918d]">No notes in this report.</p>
    );
  }

  if (section === 'blockers' && isBlockers(item.content)) {
    return item.content.length > 0 ? (
      <ul className="space-y-3">
        {item.content.map((blocker, index) => (
          <li
            key={`${blocker.description}-${index}`}
            className="flex items-start gap-2 text-sm"
          >
            <span
              aria-hidden="true"
              className={`mt-1.5 size-2 shrink-0 rounded-full ${
                blocker.isResolved ? 'bg-[#168765]' : 'bg-[#cf7624]'
              }`}
            />
            <span className="min-w-0 flex-1 text-[#38433e]">
              {blocker.description}
              <span className="ml-2 inline-flex flex-wrap gap-1.5">
                {blocker.isKey ? (
                  <span className="rounded-full bg-[#fff0d9] px-2 py-0.5 text-[11px] text-[#8a4b0c]">
                    Key
                  </span>
                ) : null}
                <span className="rounded-full bg-[#eef0ee] px-2 py-0.5 text-[11px] text-[#48534e]">
                  {blocker.isResolved ? 'Resolved' : 'Open'}
                </span>
              </span>
            </span>
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-sm text-[#87918d]">No blockers in this report.</p>
    );
  }

  if (section === 'achievements' && isAchievements(item.content)) {
    return item.content.length > 0 ? (
      <ul className="space-y-2">
        {item.content.map((achievement, index) => (
          <li
            key={`${achievement.description}-${index}`}
            className="flex items-start gap-2 text-sm text-[#38433e]"
          >
            <span aria-hidden="true" className="text-[#168765]">
              ✓
            </span>
            <span>
              {achievement.description}
              {achievement.isKey ? (
                <span className="ml-2 rounded-full bg-[#d4f1e6] px-2 py-0.5 text-[11px] text-[#17654e]">
                  Key
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-sm text-[#87918d]">No achievements in this report.</p>
    );
  }

  if (section === 'nextWeek' && isNextWeekTasks(item.content)) {
    return item.content.length > 0 ? (
      <ul className="space-y-2">
        {item.content.map((task, index) => (
          <li
            key={`${task.description}-${index}`}
            className="flex items-start justify-between gap-3 text-sm"
          >
            <span className="text-[#38433e]">{task.description}</span>
            {task.estimatedHours !== null ? (
              <span className="shrink-0 text-xs text-[#66716d]">
                {task.estimatedHours}h
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-sm text-[#87918d]">
        No next-week tasks in this report.
      </p>
    );
  }

  return (
    <p className="text-sm text-red-700" role="alert">
      Section content has an unexpected format.
    </p>
  );
}

export function TeamSectionsPage() {
  const currentWeekStart = getCurrentWeekStart();
  const [weekStart, setWeekStart] = useState(currentWeekStart);
  const [section, setSection] = useState<TeamSection>('blockers');
  const sectionQuery = useTeamSection(weekStart, section);
  const items = sectionQuery.data?.data ?? [];
  const selectedLabel =
    SECTION_OPTIONS.find((option) => option.value === section)?.label ??
    'Section';

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Team sections
          </h1>
          <p className="mt-1 text-sm text-[#66716d]">
            Compare report details across submitted team reports.
          </p>
        </div>
        <WeekPicker
          weekStart={weekStart}
          currentWeekStart={currentWeekStart}
          onChange={setWeekStart}
        />
      </header>

      <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-[#dedfdc] bg-white px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold">Report section</h2>
          <p className="mt-1 text-xs text-[#66716d]">
            Only submitted and approved snapshots are shown.
          </p>
        </div>
        <label className="flex flex-col gap-1 text-xs text-[#545f5b]">
          Show
          <select
            value={section}
            onChange={(event) =>
              setSection(
                SECTION_OPTIONS.find(
                  (option) => option.value === event.currentTarget.value,
                )?.value ?? 'blockers',
              )
            }
            className="h-9 min-w-48 rounded-md border border-[#c9ccc7] bg-white px-2 text-sm text-[#202623] outline-none focus:border-[#0c7c72] focus:ring-2 focus:ring-[#0c7c72]/15"
          >
            {SECTION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {sectionQuery.isError ? (
        <section className="rounded-xl border border-red-200 bg-white px-6 py-12 text-center">
          <p className="text-sm text-red-700" role="alert">
            We couldn’t load team report sections. Please try again.
          </p>
          <button
            type="button"
            onClick={() => void sectionQuery.refetch()}
            className="mt-3 text-sm font-medium text-[#08796f] underline underline-offset-2"
          >
            Try again
          </button>
        </section>
      ) : sectionQuery.isLoading ? (
        <p
          className="rounded-xl border border-[#dedfdc] bg-white px-6 py-12 text-center text-sm text-[#66716d]"
          role="status"
          aria-live="polite"
        >
          Loading {selectedLabel.toLowerCase()}…
        </p>
      ) : items.length === 0 ? (
        <section className="rounded-xl border border-[#dedfdc] bg-white px-6 py-12 text-center">
          <h2 className="text-sm font-semibold">
            No submitted reports for this week
          </h2>
          <p className="mt-1 text-sm text-[#66716d]">
            Team sections appear after members submit their reports.
          </p>
        </section>
      ) : (
        <section
          className="grid gap-4 lg:grid-cols-2"
          aria-label={`${selectedLabel} from team reports`}
        >
          {items.map((item) => (
            <article
              key={item.reportId}
              className="rounded-xl border border-[#dedfdc] bg-white p-5"
            >
              <header className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#eceeeb] pb-3">
                <h2 className="text-sm font-semibold">
                  <Link
                    href={`/manager/team/${encodeURIComponent(item.user.id)}`}
                    className="text-[#08796f] hover:underline"
                  >
                    {item.user.name}
                  </Link>
                </h2>
                <Link
                  href={`/manager/reports/${encodeURIComponent(item.reportId)}/review`}
                  className="text-xs font-medium text-[#08796f] hover:underline"
                >
                  View report
                </Link>
              </header>
              {renderContent(section, item)}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
