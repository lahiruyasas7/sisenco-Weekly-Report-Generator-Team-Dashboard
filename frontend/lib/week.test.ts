import { describe, expect, it } from 'vitest';
import { getWeekEnd, shiftWeekStart } from '@/lib/week';

describe('week helpers', () => {
  it('computes week ends and shifts weeks using date-only UTC arithmetic', () => {
    expect(getWeekEnd('2026-11-02')).toBe('2026-11-08');
    expect(shiftWeekStart('2026-11-02', -1)).toBe('2026-10-26');
    expect(shiftWeekStart('2026-11-02', 1)).toBe('2026-11-09');
  });
});
