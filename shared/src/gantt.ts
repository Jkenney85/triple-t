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
 * Where a card sits on the Gantt chart. Its day of week is a rolling plan
 * (Done clears it), so it lands on the next occurrence of that weekday in the
 * 7 days starting at `planFrom` (yesterday). The due date is absolute; with
 * both, the bar runs from one to the other.
 */
export function ganttSpan(
  card: { dayOfWeek: number | null; dueAt: number | null },
  planFrom: YMD,
  timeZone: string,
): GanttSpan | null {
  const fromWeekday = new Date(Date.UTC(planFrom.y, planFrom.m - 1, planFrom.d)).getUTCDay();
  const planned = card.dayOfWeek != null ? addDays(planFrom, (card.dayOfWeek - fromWeekday + 7) % 7) : null;
  const due = card.dueAt != null ? ymdInTz(card.dueAt, timeZone) : null;
  if (!planned && !due) return null;
  if (planned && due) {
    const late = dayNumber(planned) > dayNumber(due);
    return { start: late ? due : planned, end: late ? planned : due, planned, due, late };
  }
  const only = (planned ?? due)!;
  return { start: only, end: only, planned, due, late: false };
}
