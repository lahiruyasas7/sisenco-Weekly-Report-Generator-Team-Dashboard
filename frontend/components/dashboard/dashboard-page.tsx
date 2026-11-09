'use client';

import Link from 'next/link';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useState } from 'react';
import { WeekPicker } from '@/components/team/week-picker';
import {
  useDashboardActivity,
  useDashboardStatusByMember,
  useDashboardSummary,
  useDashboardTasksTrend,
  useDashboardTimeByType,
  useDashboardWorkloadByProject,
} from '@/lib/hooks/use-dashboard';
import { useCurrentUser } from '@/lib/hooks/use-auth';
import type {
  DashboardActivityItem,
  DashboardStatusByMemberItem,
  DashboardSummary,
  TeamReportStatus,
} from '@/lib/types';
import { getCurrentWeekStart, shiftWeekStart } from '@/lib/week';

const STATUS_COLORS: Record<TeamReportStatus, string> = {
  NOT_STARTED: '#aab4af',
  DRAFT: '#d8a43b',
  SUBMITTED: '#3986bd',
  NEEDS_CORRECTION: '#d46b45',
  APPROVED: '#27816d',
};

const TASK_TYPE_COLORS = [
  '#176b5b',
  '#3694a5',
  '#d79a35',
  '#7962a8',
  '#d16f4d',
  '#80944a',
];

const STATUS_SERIES: { key: TeamReportStatus; label: string }[] = [
  { key: 'NOT_STARTED', label: 'Not started' },
  { key: 'DRAFT', label: 'Draft' },
  { key: 'SUBMITTED', label: 'Submitted' },
  { key: 'NEEDS_CORRECTION', label: 'Needs correction' },
  { key: 'APPROVED', label: 'Approved' },
];

function formatWeek(value: string): string {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00Z`));
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatActivity(item: DashboardActivityItem): string {
  if (item.type === 'SUBMISSION') {
    return `${item.submittedBy.name} submitted a report for ${item.member.name}`;
  }
  return item.action === 'APPROVED'
    ? `${item.reviewer.name} approved ${item.member.name}'s report`
    : `${item.reviewer.name} requested changes to ${item.member.name}'s report`;
}

function QueryPanel({
  isLoading,
  isError,
  isEmpty,
  onRetry,
  emptyMessage,
  children,
}: {
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  onRetry: () => void;
  emptyMessage: string;
  children: React.ReactNode;
}) {
  if (isLoading) {
    return (
      <p
        className="px-5 py-12 text-center text-sm text-[#66716d]"
        role="status"
      >
        Loading dashboard data…
      </p>
    );
  }
  if (isError) {
    return (
      <div className="px-5 py-10 text-center">
        <p className="text-sm text-red-700" role="alert">
          We couldn’t load this dashboard section.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 text-sm font-medium text-[#08796f] underline underline-offset-2"
        >
          Try again
        </button>
      </div>
    );
  }
  if (isEmpty) {
    return (
      <p className="px-5 py-12 text-center text-sm text-[#66716d]">
        {emptyMessage}
      </p>
    );
  }
  return <div className="p-4 sm:p-5">{children}</div>;
}

function DashboardCard({
  title,
  description,
  children,
  className = '',
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`min-w-0 overflow-hidden rounded-xl border border-[#dedfdc] bg-white ${className}`}
      aria-label={title}
    >
      <div className="border-b border-[#eceeeb] px-5 py-4">
        <h2 className="text-sm font-semibold text-[#202623]">{title}</h2>
        {description ? (
          <p className="mt-1 text-xs leading-5 text-[#66716d]">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <section className="rounded-xl border border-[#dedfdc] bg-white p-4 sm:p-5">
      <p className="text-xs font-medium text-[#66716d]">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-[#183f38]">
        {value}
      </p>
      <p className="mt-1 text-xs text-[#66716d]">{detail}</p>
    </section>
  );
}

function SummaryMetrics({
  summary,
}: {
  summary: DashboardSummary | undefined;
}) {
  if (!summary) return null;
  const { compliance } = summary;
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        label="Reports submitted"
        value={summary.totalSubmitted}
        detail={`For week starting ${formatWeek(summary.weekStart)}`}
      />
      <section
        aria-label="Submission compliance"
        className="rounded-xl border border-[#dedfdc] bg-white p-4 sm:p-5"
      >
        <p className="text-xs font-medium text-[#66716d]">
          Submission compliance
        </p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
          <span>
            <strong className="text-[#27816d]">{compliance.onTime}</strong> on
            time
          </span>
          <span>
            <strong className="text-[#b45a38]">{compliance.late}</strong> late
          </span>
          <span>
            <strong className="text-[#66716d]">{compliance.pending}</strong>{' '}
            pending
          </span>
        </div>
        <p className="mt-2 text-xs text-[#66716d]">
          {compliance.eligible} eligible team members
        </p>
      </section>
      <MetricCard
        label="Needs correction"
        value={summary.needsCorrection}
        detail="Reports awaiting member updates"
      />
      <MetricCard
        label="Open blockers"
        value={summary.openBlockers}
        detail="Across submitted and approved reports"
      />
    </div>
  );
}

function statusChartRows(data: DashboardStatusByMemberItem[]) {
  return data.map(({ user, status }) => ({
    member: user.name,
    ...Object.fromEntries(
      STATUS_SERIES.map(({ key }) => [key, status === key ? 1 : 0]),
    ),
  }));
}

function statusCount(
  data: DashboardStatusByMemberItem[],
  status: TeamReportStatus,
): number {
  return data.reduce(
    (count, item) => count + Number(item.status === status),
    0,
  );
}

function ActivityRow({ item }: { item: DashboardActivityItem }) {
  return (
    <li className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <Link
          href={`/manager/reports/${encodeURIComponent(item.reportId)}/review`}
          className="text-sm font-medium text-[#20584f] hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-[#0c7c72]"
        >
          {formatActivity(item)}
        </Link>
        <p className="mt-1 text-xs text-[#66716d]">
          Week of {formatWeek(item.weekStart)}
          {item.type === 'SUBMISSION' ? ` · Version ${item.versionNumber}` : ''}
          {item.type === 'REVIEW' && item.comment ? ` · ${item.comment}` : ''}
        </p>
      </div>
      <time
        dateTime={item.timestamp}
        className="shrink-0 text-right text-xs text-[#66716d]"
      >
        {formatTimestamp(item.timestamp)}
      </time>
    </li>
  );
}

function ManagerDashboard({
  weekStart,
  onWeekChange,
}: {
  weekStart: string;
  onWeekChange: (weekStart: string) => void;
}) {
  const currentWeekStart = getCurrentWeekStart();
  const range = {
    from: shiftWeekStart(weekStart, -11),
    to: weekStart,
  };
  const summaryQuery = useDashboardSummary(weekStart);
  const trendQuery = useDashboardTasksTrend(range);
  const statusQuery = useDashboardStatusByMember(weekStart);
  const workloadQuery = useDashboardWorkloadByProject(range);
  const timeQuery = useDashboardTimeByType(range);
  const activityQuery = useDashboardActivity(10);
  const statusData = statusQuery.data?.data ?? [];
  const timeData = timeQuery.data?.data ?? [];
  const totalTimeHours = timeData.reduce((sum, item) => sum + item.hours, 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Team dashboard
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[#66716d]">
            Weekly reporting, workload, and activity across your team.
          </p>
        </div>
        <WeekPicker
          weekStart={weekStart}
          currentWeekStart={currentWeekStart}
          onChange={onWeekChange}
        />
      </header>

      <DashboardCard
        title="Weekly overview"
        description="Summary metrics use the selected report week."
      >
        {summaryQuery.isLoading ? (
          <p className="px-5 py-8 text-sm text-[#66716d]" role="status">
            Loading weekly summary…
          </p>
        ) : summaryQuery.isError ? (
          <div className="px-5 py-8">
            <p className="text-sm text-red-700" role="alert">
              We couldn’t load the weekly summary.
            </p>
            <button
              type="button"
              onClick={() => void summaryQuery.refetch()}
              className="mt-2 text-sm font-medium text-[#08796f] underline underline-offset-2"
            >
              Try again
            </button>
          </div>
        ) : summaryQuery.data ? (
          <div className="p-4 sm:p-5">
            <SummaryMetrics summary={summaryQuery.data} />
          </div>
        ) : (
          <p className="px-5 py-8 text-sm text-[#66716d]">
            No summary data is available for this week.
          </p>
        )}
      </DashboardCard>

      <div className="grid gap-5 xl:grid-cols-2">
        <DashboardCard
          title="Completed tasks trend"
          description={`Weekly completed tasks · ${formatWeek(range.from)} to ${formatWeek(range.to)}`}
        >
          <QueryPanel
            isLoading={trendQuery.isLoading}
            isError={trendQuery.isError}
            isEmpty={!trendQuery.isLoading && !trendQuery.data?.data.length}
            onRetry={() => void trendQuery.refetch()}
            emptyMessage="No completed-task trend data is available."
          >
            <div
              className="h-[280px] w-full"
              role="img"
              aria-label="Completed tasks by week"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendQuery.data?.data}>
                  <CartesianGrid stroke="#e8ece9" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="weekStart"
                    tickFormatter={formatWeek}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    labelFormatter={(value) =>
                      `Week of ${formatWeek(String(value))}`
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="completedTasks"
                    name="Completed tasks"
                    stroke="#176b5b"
                    strokeWidth={3}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </QueryPanel>
        </DashboardCard>

        <DashboardCard
          title="Report status by member"
          description={`${statusData.length} eligible active members · selected week`}
        >
          <QueryPanel
            isLoading={statusQuery.isLoading}
            isError={statusQuery.isError}
            isEmpty={!statusQuery.isLoading && statusData.length === 0}
            onRetry={() => void statusQuery.refetch()}
            emptyMessage="No eligible active members for this week."
          >
            <div className="mb-3 flex flex-wrap gap-x-4 gap-y-2">
              {STATUS_SERIES.map(({ key, label }) => (
                <span
                  key={key}
                  className="inline-flex items-center gap-1.5 text-xs text-[#58635f]"
                >
                  <span
                    aria-hidden="true"
                    className="size-2.5 rounded-sm"
                    style={{ backgroundColor: STATUS_COLORS[key] }}
                  />
                  {label} ({statusCount(statusData, key)})
                </span>
              ))}
            </div>
            <div className="max-h-[440px] overflow-y-auto">
              <div
                className="w-full"
                style={{
                  height: Math.min(640, Math.max(220, statusData.length * 38)),
                }}
                role="img"
                aria-label="Report status for each eligible member"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={statusChartRows(statusData)}
                    layout="vertical"
                    margin={{ left: 12, right: 12 }}
                  >
                    <CartesianGrid stroke="#e8ece9" horizontal={false} />
                    <XAxis type="number" domain={[0, 1]} hide />
                    <YAxis
                      type="category"
                      dataKey="member"
                      width={105}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(value, name) =>
                        Number(value) > 0
                          ? [Number(value), String(name).replaceAll('_', ' ')]
                          : null
                      }
                    />
                    {STATUS_SERIES.map(({ key, label }) => (
                      <Bar
                        key={key}
                        dataKey={key}
                        name={label}
                        stackId="status"
                        fill={STATUS_COLORS[key]}
                        isAnimationActive={false}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </QueryPanel>
        </DashboardCard>

        <DashboardCard
          title="Workload by project"
          description="Task count and spent hours · submitted and approved reports"
        >
          <QueryPanel
            isLoading={workloadQuery.isLoading}
            isError={workloadQuery.isError}
            isEmpty={
              !workloadQuery.isLoading && !workloadQuery.data?.data.length
            }
            onRetry={() => void workloadQuery.refetch()}
            emptyMessage="No submitted or approved project workload in this range."
          >
            <div
              className="h-[300px] w-full"
              role="img"
              aria-label="Task count and spent hours by project"
            >
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={workloadQuery.data?.data}
                  margin={{ top: 8, right: 8, bottom: 40, left: 0 }}
                >
                  <CartesianGrid stroke="#e8ece9" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="projectName"
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis
                    yAxisId="tasks"
                    allowDecimals={false}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    yAxisId="hours"
                    orientation="right"
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip />
                  <Legend verticalAlign="top" height={28} />
                  <Bar
                    yAxisId="tasks"
                    dataKey="taskCount"
                    name="Tasks"
                    fill="#3694a5"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={false}
                  />
                  <Line
                    yAxisId="hours"
                    type="monotone"
                    dataKey="spentHours"
                    name="Spent hours"
                    stroke="#d79a35"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </QueryPanel>
        </DashboardCard>

        <DashboardCard
          title="Time by task type"
          description="Team hours · submitted and approved reports"
        >
          <QueryPanel
            isLoading={timeQuery.isLoading}
            isError={timeQuery.isError}
            isEmpty={!timeQuery.isLoading && totalTimeHours === 0}
            onRetry={() => void timeQuery.refetch()}
            emptyMessage="No tracked hours in submitted or approved reports for this range."
          >
            <div
              className="h-[300px] w-full"
              role="img"
              aria-label="Team hours by task type"
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={timeData.filter((item) => item.hours > 0)}
                    dataKey="hours"
                    nameKey="taskType"
                    cx="50%"
                    cy="48%"
                    outerRadius={92}
                    label={({ name, percent }) =>
                      `${String(name).replaceAll('_', ' ')} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                    isAnimationActive={false}
                  >
                    {timeData
                      .filter((item) => item.hours > 0)
                      .map((item) => (
                        <Cell
                          key={item.taskType}
                          fill={
                            TASK_TYPE_COLORS[
                              timeData.findIndex(
                                (candidate) =>
                                  candidate.taskType === item.taskType,
                              ) % TASK_TYPE_COLORS.length
                            ]
                          }
                        />
                      ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} hours`, 'Time']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </QueryPanel>
        </DashboardCard>
      </div>

      <DashboardCard
        title="Recent activity"
        description="Latest report submissions and manager review actions."
      >
        <QueryPanel
          isLoading={activityQuery.isLoading}
          isError={activityQuery.isError}
          isEmpty={!activityQuery.isLoading && !activityQuery.data?.data.length}
          onRetry={() => void activityQuery.refetch()}
          emptyMessage="No recent report activity."
        >
          <ol className="divide-y divide-[#eceeeb]">
            {activityQuery.data?.data.map((item) => (
              <ActivityRow key={`${item.type}:${item.id}`} item={item} />
            ))}
          </ol>
        </QueryPanel>
      </DashboardCard>
    </div>
  );
}

export function DashboardPage({
  initialWeekStart,
}: {
  initialWeekStart: string;
}) {
  const currentUser = useCurrentUser();
  const [weekStart, setWeekStart] = useState(initialWeekStart);

  if (currentUser.isLoading || !currentUser.data) {
    return (
      <p
        className="py-12 text-center text-sm text-[#66716d]"
        role="status"
        aria-live="polite"
      >
        Loading your dashboard…
      </p>
    );
  }

  if (currentUser.data.role === 'MEMBER') {
    return (
      <section className="rounded-xl border border-[#dedfdc] bg-white p-7 sm:p-9">
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome to Weekly Reports
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#66716d]">
          View and manage your weekly reports from the reports section.
        </p>
      </section>
    );
  }

  if (!weekStart) {
    return (
      <p className="py-12 text-center text-sm text-[#66716d]" role="status">
        Preparing your team dashboard…
      </p>
    );
  }

  return <ManagerDashboard weekStart={weekStart} onWeekChange={setWeekStart} />;
}
