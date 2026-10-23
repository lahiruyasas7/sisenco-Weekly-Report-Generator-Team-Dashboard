import { BadRequestException } from '@nestjs/common';
import { DateTime } from 'luxon';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function parseReportDate(value: string, timezone: string): DateTime {
  if (!DATE_ONLY.test(value)) {
    throw new BadRequestException('Dates must use YYYY-MM-DD format');
  }
  const date = DateTime.fromISO(value, { zone: timezone });
  if (!date.isValid || date.toISODate() !== value) {
    throw new BadRequestException('Invalid report date');
  }
  return date.startOf('day');
}

export function assertMonday(date: DateTime): void {
  if (date.weekday !== 1) {
    throw new BadRequestException('weekStart must be a Monday');
  }
}

export function currentWeekStart(
  timezone: string,
  now: DateTime = DateTime.now(),
): DateTime {
  const localNow = now.setZone(timezone);
  return localNow.startOf('day').minus({ days: localNow.weekday - 1 });
}

export function reportWeekEnd(weekStart: DateTime): DateTime {
  return weekStart.plus({ days: 6 }).startOf('day');
}

export function dateOnlyToDatabase(date: DateTime): Date {
  return DateTime.fromISO(date.toISODate() ?? '', { zone: 'utc' }).toJSDate();
}

export function databaseDateToOnly(date: Date): string {
  return DateTime.fromJSDate(date, { zone: 'utc' }).toISODate() ?? '';
}

export function submissionDeadline(
  weekStart: DateTime,
  timezone: string,
  offsetDays: number,
): DateTime {
  return weekStart.setZone(timezone).startOf('day').plus({ days: offsetDays });
}
