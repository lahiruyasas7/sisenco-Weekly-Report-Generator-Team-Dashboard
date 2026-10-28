import { DateTime } from 'luxon';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { describe, expect, it, vi } from 'vitest';
import { buildDemoReportFixtures } from './demo-fixtures.js';
import { seedDemoData } from './demo-seed.js';

describe('seedDemoData', () => {
  it('upserts fixture identities and replaces only seeded report children on reruns', async () => {
    const operationCounts = new Map<string, number>();
    let versionSequence = 0;
    const track = (operation: string) => {
      operationCounts.set(operation, (operationCounts.get(operation) ?? 0) + 1);
    };
    const reportUpsert = vi.fn(async ({ where }) => {
      track('report.upsert');
      return {
        id: `${where.userId_weekStart.userId}-${where.userId_weekStart.weekStart.toISOString()}`,
      };
    });
    const versionCreate = vi.fn(async () => ({
      id: `version-${++versionSequence}`,
    }));
    const childDelegate = (name: string) => ({
      deleteMany: vi.fn(async () => {
        track(`${name}.deleteMany`);
        return { count: 0 };
      }),
      createMany: vi.fn(async () => {
        track(`${name}.createMany`);
        return { count: 0 };
      }),
    });
    const transaction = {
      user: {
        findUnique: vi.fn(async () => null),
        upsert: vi.fn(async () => ({})),
      },
      userSession: {
        updateMany: vi.fn(async () => ({ count: 0 })),
      },
      project: {
        findFirst: vi.fn(async () => null),
        upsert: vi.fn(async () => ({})),
      },
      projectMember: {
        deleteMany: vi.fn(async () => ({ count: 0 })),
        createMany: vi.fn(async () => ({ count: 0 })),
      },
      report: {
        upsert: reportUpsert,
        deleteMany: vi.fn(async () => ({ count: 0 })),
      },
      review: {
        deleteMany: vi.fn(async () => {
          track('review.deleteMany');
          return { count: 0 };
        }),
        create: vi.fn(async () => ({})),
      },
      reportVersion: {
        deleteMany: vi.fn(async () => {
          track('reportVersion.deleteMany');
          return { count: 0 };
        }),
        create: versionCreate,
      },
      reportTask: childDelegate('reportTask'),
      nextWeekTask: childDelegate('nextWeekTask'),
      blocker: childDelegate('blocker'),
      achievement: childDelegate('achievement'),
      timeEntry: childDelegate('timeEntry'),
    };
    const prisma = {
      $transaction: vi.fn(
        async (callback: (tx: typeof transaction) => Promise<void>) =>
          callback(transaction),
      ),
    } as unknown as PrismaClient;
    const now = DateTime.fromISO('2026-10-28T10:00:00', {
      zone: 'Asia/Colombo',
    });
    const fixtures = buildDemoReportFixtures({
      now,
      timezone: 'Asia/Colombo',
      dueOffsetDays: 7,
    });

    await seedDemoData(prisma, 'hashed-demo-password', 'Asia/Colombo', 7, now);
    await seedDemoData(prisma, 'hashed-demo-password', 'Asia/Colombo', 7, now);

    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(transaction.user.upsert).toHaveBeenCalledTimes(12);
    expect(transaction.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          email: 'demo.manager@example.test',
          createdAt: expect.any(Date),
        }),
        update: expect.objectContaining({
          email: 'demo.manager@example.test',
          createdAt: expect.any(Date),
        }),
      }),
    );
    expect(transaction.project.upsert).toHaveBeenCalledTimes(10);
    expect(reportUpsert).toHaveBeenCalledTimes(fixtures.length * 2);
    expect(transaction.reportVersion.deleteMany).toHaveBeenCalledTimes(
      fixtures.length * 2,
    );
    expect(transaction.review.deleteMany).toHaveBeenCalledTimes(
      fixtures.length * 2,
    );
    expect(versionCreate).toHaveBeenCalledTimes(
      fixtures.reduce((total, fixture) => total + fixture.versions.length, 0) *
        2,
    );
    expect(transaction.report.deleteMany).toHaveBeenCalledTimes(2);
    expect(transaction.report.deleteMany).toHaveBeenLastCalledWith({
      where: {
        userId: 'd1000000-0000-4000-8000-000000000002',
        weekStart: expect.any(Date),
      },
    });
  });
});
