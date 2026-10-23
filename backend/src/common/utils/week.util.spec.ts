import { BadRequestException } from '@nestjs/common';
import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import {
  assertMonday,
  currentWeekStart,
  parseReportDate,
  reportWeekEnd,
  submissionDeadline,
} from './week.util.js';

describe('report week utilities', () => {
  it('accepts Monday and rejects other weekdays', () => {
    expect(() =>
      assertMonday(parseReportDate('2026-10-19', 'Asia/Colombo')),
    ).not.toThrow();
    expect(() =>
      assertMonday(parseReportDate('2026-10-20', 'Asia/Colombo')),
    ).toThrow(BadRequestException);
  });

  it('rejects malformed and impossible date-only values', () => {
    expect(() => parseReportDate('2026-1-19', 'Asia/Colombo')).toThrow(
      BadRequestException,
    );
    expect(() => parseReportDate('2026-02-30', 'Asia/Colombo')).toThrow(
      BadRequestException,
    );
  });

  it('ends the report week six calendar days after Monday', () => {
    const monday = parseReportDate('2026-10-19', 'Asia/Colombo');
    expect(reportWeekEnd(monday).toISODate()).toBe('2026-10-25');
  });

  it('calculates the current week using the configured timezone', () => {
    const instant = DateTime.fromISO('2026-10-18T20:00:00Z', { zone: 'utc' });
    expect(currentWeekStart('Asia/Colombo', instant).toISODate()).toBe(
      '2026-10-19',
    );
    expect(currentWeekStart('America/Los_Angeles', instant).toISODate()).toBe(
      '2026-10-12',
    );
  });

  it('calculates deadline from local midnight plus the configured offset', () => {
    const monday = parseReportDate('2026-10-19', 'Asia/Colombo');
    expect(submissionDeadline(monday, 'Asia/Colombo', 7).toISO()).toBe(
      '2026-10-26T00:00:00.000+05:30',
    );
  });
});
