export type DueStatus = 'none' | 'overdue' | 'soon' | 'later';

export const DAY_MS = 24 * 60 * 60 * 1000;

export function dueStatus(dueAt: number | null | undefined, now: number = Date.now()): DueStatus {
  if (dueAt == null) return 'none';
  if (dueAt < now) return 'overdue';
  if (dueAt - now <= DAY_MS) return 'soon';
  return 'later';
}

/**
 * Due dates are date-only. A card is due through the end of that day in the
 * board's time zone, so it turns amber on the day and red the day after.
 */
export interface YMD {
  y: number;
  /** 1–12 */
  m: number;
  d: number;
}

/** Offset of `timeZone` from UTC at instant `ms`, in milliseconds (local − UTC). */
function tzOffsetMs(ms: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(ms));
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/** Calendar date of instant `ms` in `timeZone`. */
export function ymdInTz(ms: number, timeZone: string): YMD {
  const local = new Date(ms + tzOffsetMs(ms, timeZone));
  return { y: local.getUTCFullYear(), m: local.getUTCMonth() + 1, d: local.getUTCDate() };
}

/** 23:59:59.999 on the given date in `timeZone`, as epoch ms (handles DST changes). */
export function endOfDayInTz({ y, m, d }: YMD, timeZone: string): number {
  const guess = Date.UTC(y, m - 1, d, 23, 59, 59, 999);
  let t = guess - tzOffsetMs(guess, timeZone);
  const second = tzOffsetMs(t, timeZone);
  if (guess - second !== t) t = guess - second;
  return t;
}

export function addDays({ y, m, d }: YMD, days: number): YMD {
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

export const sameYmd = (a: YMD | null, b: YMD | null) => !!a && !!b && a.y === b.y && a.m === b.m && a.d === b.d;
