import { describe, expect, it } from 'vitest';
import { endOfDayInTz } from './due';
import { dayNumber, ganttSpan, weekStartOf } from './gantt';

const TZ = 'America/Chicago';
const week = { y: 2026, m: 10, d: 11 }; // Sunday Oct 11, 2026
const due = (d: number) => endOfDayInTz({ y: 2026, m: 10, d }, TZ);

describe('gantt placement', () => {
  it('finds the Sunday that starts the week', () => {
    expect(weekStartOf({ y: 2026, m: 10, d: 14 })).toEqual(week);
    expect(weekStartOf(week)).toEqual(week);
    expect(weekStartOf({ y: 2026, m: 11, d: 2 })).toEqual({ y: 2026, m: 11, d: 1 });
  });

  it('puts a day-of-week card on that weekday this week', () => {
    expect(ganttSpan({ dayOfWeek: 3, dueAt: null }, week, TZ)).toMatchObject({ start: { y: 2026, m: 10, d: 14 }, end: { y: 2026, m: 10, d: 14 }, due: null });
  });

  it('puts a due-only card on its due date', () => {
    expect(ganttSpan({ dayOfWeek: null, dueAt: due(20) }, week, TZ)).toMatchObject({ start: { y: 2026, m: 10, d: 20 }, planned: null });
  });

  it('runs a bar from the planned day to the due date', () => {
    const span = ganttSpan({ dayOfWeek: 1, dueAt: due(17) }, week, TZ)!;
    expect(span.start).toEqual({ y: 2026, m: 10, d: 12 });
    expect(span.end).toEqual({ y: 2026, m: 10, d: 17 });
    expect(span.late).toBe(false);
    expect(dayNumber(span.end) - dayNumber(span.start)).toBe(5);
  });

  it('flags a card planned for after its due date', () => {
    const span = ganttSpan({ dayOfWeek: 6, dueAt: due(13) }, week, TZ)!;
    expect(span).toMatchObject({ late: true, start: { d: 13 }, end: { d: 17 } });
  });

  it('skips cards with neither', () => {
    expect(ganttSpan({ dayOfWeek: null, dueAt: null }, week, TZ)).toBeNull();
  });
});
