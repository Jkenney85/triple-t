import { addDays, ymdInTz, type YMD } from './due';

/** Days since 1970-01-01 for a calendar date (handy for comparing and measuring spans). */
export const dayNumber = ({ y, m, d }: YMD) => Math.round(Date.UTC(y, m - 1, d) / 86_400_000);

/** The Sunday that starts the week containing `day`. */
export function weekStartOf(day: YMD): YMD {
  const weekday = new Date(Date.UTC(day.y, day.m - 1, day.d)).getUTCDay();
  return addDays(day, -weekday);
}

export interface GanttSpan {
  start: YMD;
  end: YMD;
  /** The card's day of week, placed in the current week. */
  planned: YMD | null;
  due: YMD | null;
  /** Planned for a day after it's due. */
  late: boolean;
}

/**
 * Where a card sits on the Gantt chart. Its day of week is "this week's plan"
 * (Done clears it), so it lands on that weekday in the current week; the due
 * date is absolute. With both, the bar runs from one to the other.
 */
export function ganttSpan(
  card: { dayOfWeek: number | null; dueAt: number | null },
  thisWeekStart: YMD,
  timeZone: string,
): GanttSpan | null {
  const planned = card.dayOfWeek != null ? addDays(thisWeekStart, card.dayOfWeek) : null;
  const due = card.dueAt != null ? ymdInTz(card.dueAt, timeZone) : null;
  if (!planned && !due) return null;
  if (planned && due) {
    const late = dayNumber(planned) > dayNumber(due);
    return { start: late ? due : planned, end: late ? planned : due, planned, due, late };
  }
  const only = (planned ?? due)!;
  return { start: only, end: only, planned, due, late: false };
}
