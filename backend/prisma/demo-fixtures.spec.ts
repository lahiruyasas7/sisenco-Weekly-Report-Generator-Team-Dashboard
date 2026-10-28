import { DateTime } from 'luxon';
import { ReportStatus, ReviewAction } from '../src/generated/prisma/client.js';
import { describe, expect, it } from 'vitest';
import {
  buildDemoReportFixtures,
  DEMO_PROJECTS,
  DEMO_USERS,
} from './demo-fixtures.js';

const now = DateTime.fromISO('2026-10-28T10:00:00', {
  zone: 'Asia/Colombo',
});

function buildFixtures() {
  return buildDemoReportFixtures({
    now,
    timezone: 'Asia/Colombo',
    dueOffsetDays: 7,
  });
}

describe('demo report fixtures', () => {
  it('creates eight timezone-aware weeks with one member missing a current-week report', () => {
    const fixtures = buildFixtures();
    const currentWeek = now.startOf('week').toISODate();

    expect(fixtures).toHaveLength(39);
    expect(
      fixtures.some(
        (fixture) =>
          fixture.userId === DEMO_USERS[1].id &&
          DateTime.fromJSDate(fixture.weekStart, {
            zone: 'utc',
          }).toISODate() === currentWeek,
      ),
    ).toBe(false);
    expect(
      new Set(fixtures.map((fixture) => fixture.weekStart.toISOString())),
    ).toHaveProperty('size', 8);

    for (const fixture of fixtures) {
      const weekStart = DateTime.fromJSDate(fixture.weekStart, { zone: 'utc' });
      const weekEnd = DateTime.fromJSDate(fixture.weekEnd, { zone: 'utc' });
      expect(weekStart.weekday).toBe(1);
      expect(weekEnd.diff(weekStart, 'days').days).toBe(6);
      expect(DEMO_PROJECTS.map(({ id }) => id)).toContain(fixture.projectId);
      expect(fixture.updatedAt.getTime()).toBe(now.toJSDate().getTime());
      expect(
        [
          ...fixture.versions,
          ...fixture.versions.flatMap((version) =>
            version.review ? [{ submittedAt: version.review.createdAt }] : [],
          ),
        ].every(({ submittedAt }) => submittedAt <= now.toJSDate()),
      ).toBe(true);
    }
  });

  it('creates consistent versions and review transitions', () => {
    const fixtures = buildFixtures();
    const statuses = new Set(fixtures.map(({ status }) => status));
    const versions = fixtures.flatMap(({ versions }) => versions);
    const multiVersionReports = fixtures.filter(
      ({ versions }) => versions.length >= 2,
    );

    expect(statuses).toEqual(
      new Set([
        ReportStatus.DRAFT,
        ReportStatus.SUBMITTED,
        ReportStatus.NEEDS_CORRECTION,
        ReportStatus.APPROVED,
      ]),
    );
    expect(multiVersionReports.length).toBeGreaterThanOrEqual(4);
    expect(
      multiVersionReports.some(({ versions }) => versions.length === 3),
    ).toBe(true);
    expect(
      versions.some(({ review }) => review?.action === ReviewAction.APPROVED),
    ).toBe(true);
    expect(
      versions.some(
        ({ review }) =>
          review?.action === ReviewAction.CHANGES_REQUESTED &&
          Boolean(review.comment?.trim()),
      ),
    ).toBe(true);

    for (const fixture of fixtures) {
      expect(fixture.currentVersion).toBe(fixture.versions.length);
      if (fixture.status === ReportStatus.DRAFT) {
        expect(fixture.currentVersion).toBe(0);
        expect(fixture.firstSubmittedAt).toBeNull();
        expect(fixture.submittedAt).toBeNull();
        expect(fixture.reviewedAt).toBeNull();
      } else {
        expect(fixture.firstSubmittedAt).toEqual(
          fixture.versions[0].submittedAt,
        );
        expect(fixture.submittedAt).toEqual(
          fixture.versions.at(-1)?.submittedAt,
        );
      }

      const currentVersion = fixture.versions.at(-1);
      if (fixture.status === ReportStatus.SUBMITTED) {
        expect(currentVersion?.review).toBeNull();
        expect(fixture.reviewedAt).toBeNull();
      } else if (fixture.status === ReportStatus.APPROVED) {
        expect(currentVersion?.review?.action).toBe(ReviewAction.APPROVED);
        expect(fixture.reviewedAt).toEqual(currentVersion?.review?.createdAt);
      } else if (fixture.status === ReportStatus.NEEDS_CORRECTION) {
        expect(currentVersion?.review?.action).toBe(
          ReviewAction.CHANGES_REQUESTED,
        );
        expect(currentVersion?.review?.comment?.trim()).toBeTruthy();
        expect(fixture.reviewedAt).toEqual(currentVersion?.review?.createdAt);
      }
    }
  });

  it('includes late submissions and unresolved blockers with valid quarter-hour values', () => {
    const fixtures = buildFixtures();
    const lateSubmissions = fixtures.filter((fixture) => {
      if (!fixture.firstSubmittedAt) return false;
      const weekStart = DateTime.fromJSDate(fixture.weekStart, {
        zone: 'utc',
      }).setZone('Asia/Colombo');
      const deadline = weekStart.plus({ days: 7 }).toJSDate();
      return fixture.firstSubmittedAt > deadline;
    });

    expect(lateSubmissions.length).toBeGreaterThan(0);
    expect(
      fixtures.some((fixture) =>
        fixture.content.blockers.some(
          (blocker) => blocker.isKey && !blocker.isResolved,
        ),
      ),
    ).toBe(true);

    for (const fixture of fixtures) {
      for (const task of fixture.content.tasks) {
        expect(task.plannedHours * 4).toBe(Math.round(task.plannedHours * 4));
        expect(task.spentHours * 4).toBe(Math.round(task.spentHours * 4));
      }
      for (const entry of fixture.content.timeEntries) {
        expect(entry.hours * 4).toBe(Math.round(entry.hours * 4));
      }
    }
  });

  it('generates the same canonical fixture data for the same clock input', () => {
    expect(buildFixtures()).toEqual(buildFixtures());
  });
});
