'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ReportContentView } from '@/components/reports/report-view';
import { ReportStatusBadge } from '@/components/reports/report-status-badge';
import {
  useReport,
  useReportReviews,
  useReportVersion,
  useReportVersions,
  useReviewReport,
} from '@/lib/hooks/use-reports';
import type { ReportReviewAction } from '@/lib/types';

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`));
}

function timestampLabel(value: string): string {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function actionLabel(action: ReportReviewAction): string {
  return action === 'APPROVED' ? 'Approved' : 'Requested changes';
}

function QueryError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
      <p className="text-sm text-red-800" role="alert">
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 text-sm font-medium text-red-800 underline underline-offset-2"
      >
        Try again
      </button>
    </div>
  );
}

function ManagerReportReviewContent({ reportId }: { reportId: string }) {
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [validationError, setValidationError] = useState('');
  const reportQuery = useReport(reportId);
  const versionsQuery = useReportVersions(reportId);
  const reviewsQuery = useReportReviews(reportId);
  const report = reportQuery.data;
  const versionNumber = selectedVersion ?? report?.currentVersion ?? 0;
  const isHistoricalVersion =
    Boolean(report) && versionNumber !== report?.currentVersion;
  const versionQuery = useReportVersion(
    reportId,
    versionNumber,
    isHistoricalVersion,
  );
  const reviewMutation = useReviewReport();

  async function submitReview(action: ReportReviewAction) {
    if (!report || report.status !== 'SUBMITTED') return;
    const trimmedComment = comment.trim();
    if (action === 'CHANGES_REQUESTED' && !trimmedComment) {
      setValidationError('Add a comment before requesting changes.');
      return;
    }

    setValidationError('');
    reviewMutation.reset();
    try {
      await reviewMutation.mutateAsync({
        reportId: report.id,
        input: {
          action,
          ...(trimmedComment ? { comment: trimmedComment } : {}),
        },
      });
    } catch {
      // Mutation error is rendered below; keep the review form available for retry.
    }
  }

  if (reportQuery.isLoading) {
    return (
      <p className="py-12 text-center text-sm text-[#66716d]" role="status">
        Loading report…
      </p>
    );
  }

  if (reportQuery.isError || !report) {
    return (
      <div className="space-y-4">
        <Link
          href="/manager/reports"
          className="text-sm font-medium text-[#08796f] hover:underline"
        >
          ← Back to reports
        </Link>
        <QueryError
          message="We couldn’t load this report. It may not exist or may no longer be visible."
          onRetry={() => void reportQuery.refetch()}
        />
      </div>
    );
  }

  const versionContent = isHistoricalVersion
    ? versionQuery.data?.content
    : report.content;
  const versionSubmittedAt = isHistoricalVersion
    ? versionQuery.data?.submittedAt
    : report.submittedAt;
  const canReview =
    report.status === 'SUBMITTED' && versionNumber === report.currentVersion;

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <Link
          href="/manager/reports"
          className="text-sm font-medium text-[#08796f] hover:underline"
        >
          Reports
        </Link>
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-[#66716d]">
              {report.user.name} / {dateLabel(report.content.weekStart)} –{' '}
              {dateLabel(report.content.weekEnd)}
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
              {report.user.name}
              {report.content.project
                ? ` · ${report.content.project.name}`
                : ''}
            </h1>
            <p className="mt-1 text-sm text-[#66716d]">
              Reviewing version {versionNumber}
              {versionSubmittedAt
                ? ` · submitted ${timestampLabel(versionSubmittedAt)}`
                : ''}
            </p>
          </div>
          <ReportStatusBadge status={report.status} />
        </header>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <section aria-label="Report content" className="min-w-0">
          {isHistoricalVersion && versionQuery.isLoading ? (
            <p
              className="py-12 text-center text-sm text-[#66716d]"
              role="status"
            >
              Loading version…
            </p>
          ) : isHistoricalVersion && versionQuery.isError ? (
            <QueryError
              message="We couldn’t load this report version."
              onRetry={() => void versionQuery.refetch()}
            />
          ) : versionContent ? (
            <ReportContentView content={versionContent} />
          ) : null}
        </section>

        <aside className="space-y-4">
          <section className="rounded-xl border border-[#dedfdc] bg-white p-5">
            <h2 className="text-base font-semibold">Review</h2>
            {canReview ? (
              <>
                <label
                  htmlFor="review-comment"
                  className="mt-3 block text-xs text-[#66716d]"
                >
                  Comment (required to request changes)
                </label>
                <textarea
                  id="review-comment"
                  value={comment}
                  maxLength={2000}
                  onChange={(event) => {
                    setComment(event.currentTarget.value);
                    setValidationError('');
                    if (reviewMutation.isError || reviewMutation.isSuccess) {
                      reviewMutation.reset();
                    }
                  }}
                  rows={4}
                  className="mt-1 w-full resize-y rounded-md border border-[#c9ccc7] bg-white px-3 py-2 text-sm outline-none focus-visible:border-[#0c7c72] focus-visible:ring-2 focus-visible:ring-[#0c7c72]/20"
                  aria-invalid={Boolean(validationError)}
                  aria-describedby={
                    validationError ? 'review-comment-error' : undefined
                  }
                />
                <p className="mt-1 text-right text-xs text-[#66716d]">
                  {comment.length}/2000
                </p>
                {validationError ? (
                  <p
                    id="review-comment-error"
                    className="mt-1 text-sm text-red-700"
                    role="alert"
                  >
                    {validationError}
                  </p>
                ) : null}
                {reviewMutation.isError ? (
                  <p className="mt-2 text-sm text-red-700" role="alert">
                    {reviewMutation.error instanceof Error
                      ? reviewMutation.error.message
                      : 'Unable to save the review. Please try again.'}
                  </p>
                ) : null}
                {reviewMutation.isSuccess ? (
                  <p className="mt-2 text-sm text-[#17654e]" role="status">
                    Review saved.
                  </p>
                ) : null}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={reviewMutation.isPending}
                    onClick={() => void submitReview('CHANGES_REQUESTED')}
                    className="min-h-10 rounded-md border border-[#c96821] px-3 py-2 text-sm font-medium text-[#9a4c13] hover:bg-[#fff7ed] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Request changes
                  </button>
                  <button
                    type="button"
                    disabled={reviewMutation.isPending}
                    onClick={() => void submitReview('APPROVED')}
                    className="min-h-10 rounded-md bg-[#0c7c72] px-3 py-2 text-sm font-semibold text-white hover:bg-[#096b62] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {reviewMutation.isPending ? 'Saving…' : 'Approve'}
                  </button>
                </div>
                <p className="mt-3 text-xs leading-5 text-[#66716d]">
                  You can change status and comment only, not the report
                  content.
                </p>
              </>
            ) : (
              <p className="mt-3 text-sm text-[#66716d]">
                {isHistoricalVersion
                  ? 'Historical versions are read-only and cannot be reviewed.'
                  : `This report is ${report.status.toLowerCase().replaceAll('_', ' ')} and cannot be reviewed.`}
              </p>
            )}
          </section>

          <section
            className="rounded-xl border border-[#dedfdc] bg-white p-5"
            aria-labelledby="report-versions-heading"
          >
            <h2
              id="report-versions-heading"
              className="text-base font-semibold"
            >
              Versions
            </h2>
            {versionsQuery.isError ? (
              <QueryError
                message="We couldn’t load report versions."
                onRetry={() => void versionsQuery.refetch()}
              />
            ) : versionsQuery.isLoading ? (
              <p className="mt-3 text-sm text-[#66716d]" role="status">
                Loading versions…
              </p>
            ) : versionsQuery.data?.data.length ? (
              <ul className="mt-2 divide-y divide-[#eceeeb]">
                {versionsQuery.data.data.map((version) => {
                  const isCurrent = version.number === report.currentVersion;
                  const isSelected = version.number === versionNumber;
                  return (
                    <li
                      key={version.number}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm"
                    >
                      <span>
                        <strong>v{version.number}</strong>
                        <span className="text-[#66716d]">
                          {' '}
                          · {timestampLabel(version.submittedAt)}
                        </span>
                        {isCurrent ? (
                          <span className="ml-2 rounded-full bg-[#e1edff] px-2 py-0.5 text-xs font-medium text-[#24518a]">
                            Current
                          </span>
                        ) : null}
                      </span>
                      {isSelected ? (
                        <span className="text-xs font-medium text-[#66716d]">
                          Viewing
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSelectedVersion(version.number)}
                          className="font-medium text-[#08796f] hover:underline"
                        >
                          View
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-[#66716d]">
                No submitted versions.
              </p>
            )}
          </section>

          <section
            className="rounded-xl border border-[#dedfdc] bg-white p-5"
            aria-labelledby="review-history-heading"
          >
            <h2 id="review-history-heading" className="text-base font-semibold">
              Comment history
            </h2>
            {reviewsQuery.isError ? (
              <QueryError
                message="We couldn’t load review history."
                onRetry={() => void reviewsQuery.refetch()}
              />
            ) : reviewsQuery.isLoading ? (
              <p className="mt-3 text-sm text-[#66716d]" role="status">
                Loading review history…
              </p>
            ) : reviewsQuery.data?.data.length ? (
              <ul className="mt-3 space-y-3">
                {reviewsQuery.data.data.map((review) => (
                  <li
                    key={`${review.versionNumber}-${review.createdAt}`}
                    className="text-sm"
                  >
                    <p className="text-xs text-[#66716d]">
                      {timestampLabel(review.createdAt)} ·{' '}
                      {review.reviewer.name} · on v{review.versionNumber} ·{' '}
                      {actionLabel(review.action)}
                    </p>
                    {review.comment ? (
                      <p className="mt-1 whitespace-pre-wrap text-[#38433e]">
                        {review.comment}
                      </p>
                    ) : (
                      <p className="mt-1 italic text-[#66716d]">
                        No comment provided.
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-[#66716d]">
                No review comments yet.
              </p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

export function ManagerReportReviewPage({ reportId }: { reportId: string }) {
  return <ManagerReportReviewContent key={reportId} reportId={reportId} />;
}
