import { describe, expect, it } from 'vitest';
import { addDays, dueStatus, endOfDayInTz, ymdInTz } from './due';

const TZ = 'America/Chicago';

describe('date-only due dates', () => {
  it('stores the end of the chosen day in the board time zone', () => {
    // Chicago is UTC-5 in October (CDT)
    expect(new Date(endOfDayInTz({ y: 2026, m: 10, d: 11 }, TZ)).toISOString()).toBe('2026-10-12T04:59:59.999Z');
  });

  it('handles the day daylight saving time ends', () => {
    // DST ends Nov 1, 2026; by end of day Chicago is UTC-6 (CST)
    expect(new Date(endOfDayInTz({ y: 2026, m: 11, d: 1 }, TZ)).toISOString()).toBe('2026-11-02T05:59:59.999Z');
    expect(new Date(endOfDayInTz({ y: 2026, m: 3, d: 8 }, TZ)).toISOString()).toBe('2026-03-09T04:59:59.999Z');
  });

  it('round-trips back to the same calendar day', () => {
    for (const day of [{ y: 2026, m: 1, d: 31 }, { y: 2026, m: 11, d: 1 }, { y: 2027, m: 2, d: 28 }]) {
      expect(ymdInTz(endOfDayInTz(day, TZ), TZ)).toEqual(day);
    }
  });

  it('is amber on the due day and red the day after', () => {
    const due = endOfDayInTz({ y: 2026, m: 10, d: 11 }, TZ);
    expect(dueStatus(due, Date.parse('2026-10-11T14:00:00Z'))).toBe('soon'); // 9am on the day
    expect(dueStatus(due, Date.parse('2026-10-09T14:00:00Z'))).toBe('later');
    expect(dueStatus(due, Date.parse('2026-10-12T14:00:00Z'))).toBe('overdue');
  });

  it('adds days across month and year ends', () => {
    expect(addDays({ y: 2026, m: 12, d: 30 }, 7)).toEqual({ y: 2027, m: 1, d: 6 });
    expect(addDays({ y: 2026, m: 3, d: 1 }, -1)).toEqual({ y: 2026, m: 2, d: 28 });
  });
});
