import type { Report, ReportContent } from '@/lib/types';
import { ReportStatusBadge } from './report-status-badge';

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00Z`));
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[#dedfdc] bg-white p-5 sm:p-6">
      <h2 className="mb-4 text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function ReportContentView({ content }: { content: ReportContent }) {
  return (
    <div className="space-y-4">
      <Section title="Week and project">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-[#66716d]">Week</dt>
            <dd className="mt-1 font-medium">
              {dateLabel(content.weekStart)} – {dateLabel(content.weekEnd)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[#66716d]">Project</dt>
            <dd className="mt-1 font-medium">
              {content.project?.name ?? 'Not selected'}
            </dd>
          </div>
        </dl>
      </Section>

      <Section title="Tasks completed">
        {content.tasks.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead className="text-xs text-[#66716d]">
                <tr className="border-b border-[#eceeeb]">
                  <th className="py-2 pr-3">Task</th>
                  <th className="px-3 py-2">Priority</th>
                  <th className="px-3 py-2">Planned / actual</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Hours planned / spent</th>
                  <th className="py-2 pl-3">Output</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eceeeb]">
                {content.tasks.map((task, index) => (
                  <tr key={`${task.name}-${index}`}>
                    <td className="py-3 pr-3 font-medium">
                      {task.name || '—'}
                    </td>
                    <td className="px-3 py-3">{task.priority}</td>
                    <td className="px-3 py-3">
                      {task.plannedPercent}% / {task.actualPercent}%
                    </td>
                    <td className="px-3 py-3">
                      {task.status.replaceAll('_', ' ')}
                    </td>
                    <td className="px-3 py-3">
                      {task.plannedHours} / {task.spentHours}
                    </td>
                    <td className="py-3 pl-3">{task.output || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-[#66716d]">No tasks added.</p>
        )}
      </Section>

      <Section title="Tasks planned for next week">
        {content.nextWeekTasks.length ? (
          <ul className="space-y-2 text-sm">
            {content.nextWeekTasks.map((task, index) => (
              <li
                key={`${task.description}-${index}`}
                className="flex justify-between gap-4"
              >
                <span>{task.description}</span>
                <span className="shrink-0 text-xs text-[#66716d]">
                  {task.priority}
                  {task.estimatedHours === null
                    ? ''
                    : ` · ${task.estimatedHours} h`}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[#66716d]">No next-week tasks added.</p>
        )}
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Blockers and challenges">
          {content.blockers.length ? (
            <ul className="space-y-2 text-sm">
              {content.blockers.map((blocker, index) => (
                <li
                  key={`${blocker.description}-${index}`}
                  className="flex gap-2"
                >
                  <span>{blocker.description}</span>
                  {blocker.isKey ? (
                    <strong className="shrink-0 text-[#8a4b0c]">Key</strong>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[#66716d]">No blockers added.</p>
          )}
        </Section>
        <Section title="Achievements and highlights">
          {content.achievements.length ? (
            <ul className="space-y-2 text-sm">
              {content.achievements.map((achievement, index) => (
                <li
                  key={`${achievement.description}-${index}`}
                  className="flex gap-2"
                >
                  <span>{achievement.description}</span>
                  {achievement.isKey ? (
                    <strong className="shrink-0 text-[#17654e]">Key</strong>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[#66716d]">No achievements added.</p>
          )}
        </Section>
      </div>

      <Section title="Hours worked by task type">
        {content.timeEntries.length ? (
          <ul className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {content.timeEntries.map((entry) => (
              <li
                key={entry.taskType}
                className="flex justify-between rounded-md bg-[#f6f7f5] px-3 py-2"
              >
                <span>{entry.taskType.replaceAll('_', ' ')}</span>
                <span className="font-medium">{entry.hours} h</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[#66716d]">No hours recorded.</p>
        )}
      </Section>

      <Section title="Notes and links">
        {content.notes ? (
          <p className="whitespace-pre-wrap text-sm">{content.notes}</p>
        ) : (
          <p className="text-sm text-[#66716d]">No notes.</p>
        )}
        {content.links.length ? (
          <ul className="mt-3 space-y-1 text-sm">
            {content.links.map((link) => (
              <li key={link}>
                <a
                  className="break-all text-[#08796f] underline"
                  href={link}
                  target="_blank"
                  rel="noreferrer"
                >
                  {link}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </Section>
    </div>
  );
}

export function ReportView({ report }: { report: Report }) {
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Weekly report: {dateLabel(report.content.weekStart)}
          </h1>
          <p className="mt-1 text-sm text-[#66716d]">
            Version {report.currentVersion || 'Draft'}
            {report.submittedAt
              ? ` · submitted ${new Date(report.submittedAt).toLocaleString()}`
              : ''}
          </p>
        </div>
        <ReportStatusBadge status={report.status} />
      </header>
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
      <ReportContentView content={report.content} />
    </div>
  );
}
