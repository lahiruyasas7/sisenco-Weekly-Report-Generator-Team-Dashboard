'use client';

import { getWeekEnd, shiftWeekStart } from '@/lib/week';

function formatWeekDate(date: string): string {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
}

export function WeekPicker({
  weekStart,
  currentWeekStart,
  onChange,
}: {
  weekStart: string;
  currentWeekStart: string;
  onChange: (weekStart: string) => void;
}) {
  const weekEnd = getWeekEnd(weekStart);
  const isCurrentWeek = weekStart === currentWeekStart;

  return (
    <div
      className="flex items-center gap-2 rounded-lg border border-[#dedfdc] bg-white p-1"
      aria-label="Select report week"
    >
      <button
        type="button"
        aria-label="Previous week"
        onClick={() => onChange(shiftWeekStart(weekStart, -1))}
        className="inline-flex size-9 items-center justify-center rounded-md text-[#38433e] hover:bg-[#f1f3f1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0c7c72]"
      >
        <span aria-hidden="true">←</span>
      </button>
      <p className="min-w-[155px] text-center text-sm font-medium text-[#202623]">
        {formatWeekDate(weekStart)} – {formatWeekDate(weekEnd)}
        {isCurrentWeek ? (
          <span className="ml-1.5 text-xs font-normal text-[#66716d]">
            This week
          </span>
        ) : null}
      </p>
      <button
        type="button"
        aria-label="Next week"
        disabled={isCurrentWeek}
        onClick={() => onChange(shiftWeekStart(weekStart, 1))}
        className="inline-flex size-9 items-center justify-center rounded-md text-[#38433e] hover:bg-[#f1f3f1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0c7c72] disabled:cursor-not-allowed disabled:opacity-40"
      >
        <span aria-hidden="true">→</span>
      </button>
      {!isCurrentWeek ? (
        <button
          type="button"
          onClick={() => onChange(currentWeekStart)}
          className="rounded-md px-2 py-2 text-xs font-medium text-[#08796f] hover:bg-[#eef5f2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0c7c72]"
        >
          Today
        </button>
      ) : null}
    </div>
  );
}
