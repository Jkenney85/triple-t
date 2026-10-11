import { describe, expect, it } from 'vitest';
import { formatMonth, isMonth, monthInTz, monthsWithData, shiftMonth, videoFieldValues } from './months';
import { computeTotal } from './totals';

const video = (months: Record<string, Record<string, string>>) => ({ months });

describe('months', () => {
  it('validates month keys', () => {
    expect(isMonth('2026-10')).toBe(true);
    expect(isMonth('2026-13')).toBe(false);
    expect(isMonth('2026-1')).toBe(false);
    expect(isMonth('1999-12')).toBe(false);
  });

  it('works out the current month in the board time zone', () => {
    // 2026-11-01 03:00 UTC is still October 31 in Chicago
    const d = new Date('2026-11-01T03:00:00Z');
    expect(monthInTz(d, 'America/Chicago')).toBe('2026-10');
    expect(monthInTz(d, 'UTC')).toBe('2026-11');
  });

  it('steps across year boundaries', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-10', -14)).toBe('2025-08');
  });

  it('formats months', () => {
    expect(formatMonth('2026-10')).toBe('Oct 2026');
    expect(formatMonth('2026-01', 'long')).toBe('January 2026');
  });
});

describe('monthly metric totals', () => {
  const views = { type: 'number' as const, totalMode: 'sum' as const };
  const ctr = { type: 'percent' as const, totalMode: 'avg' as const };
  const a = video({ '2026-09': { 1: '1000', 2: '4' }, '2026-10': { 1: '500', 2: '2' } });
  const b = video({ '2026-10': { 1: '250' } });

  it('collects one month or every month', () => {
    expect(videoFieldValues(a, 1, '2026-10')).toEqual(['500']);
    expect(videoFieldValues(a, 1, 'all').sort()).toEqual(['1000', '500']);
    expect(videoFieldValues(b, 2, 'all')).toEqual([]);
  });

  it('sums views over all months and videos, or within one month', () => {
    expect(computeTotal(views, [a, b].flatMap((v) => videoFieldValues(v, 1, 'all')))).toBe(1750);
    expect(computeTotal(views, [a, b].flatMap((v) => videoFieldValues(v, 1, '2026-10')))).toBe(750);
    expect(computeTotal(views, [a, b].flatMap((v) => videoFieldValues(v, 1, '2026-08')))).toBeNull();
  });

  it('averages CTR over the months that have it', () => {
    expect(computeTotal(ctr, [a, b].flatMap((v) => videoFieldValues(v, 2, 'all')))).toBe(3);
  });

  it('lists months with data, newest first', () => {
    expect(monthsWithData([a, b, video({ '2026-07': {} })])).toEqual(['2026-10', '2026-09']);
  });
});
