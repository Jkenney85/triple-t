/** Metrics are recorded per calendar month, keyed "YYYY-MM". */
export type MetricPeriod = 'all' | string;

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function isMonth(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const m = MONTH.exec(value);
  return !!m && Number(m[1]) >= 2000 && Number(m[1]) <= 2100;
}

/** Current month ("YYYY-MM") in the given IANA time zone. */
export function monthInTz(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit' }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get('year')}-${get('month')}`;
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/** "Oct 2026" (short) or "October 2026" (long). */
export function formatMonth(month: string, style: 'short' | 'long' = 'short'): string {
  const [y, m] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { month: style, year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1)));
}

/** A video's raw values for one field: every month for "all", or just one month. */
export function videoFieldValues(video: { months: Record<string, Record<string, string>> }, fieldId: number, period: MetricPeriod): string[] {
  const out: string[] = [];
  for (const [month, values] of Object.entries(video.months)) {
    if (period !== 'all' && month !== period) continue;
    const v = values[fieldId];
    if (v != null && v !== '') out.push(v);
  }
  return out;
}

/** Months that have at least one value, newest first. */
export function monthsWithData(videos: ReadonlyArray<{ months: Record<string, Record<string, string>> }>): string[] {
  const set = new Set<string>();
  for (const v of videos) for (const [month, values] of Object.entries(v.months)) if (Object.keys(values).length) set.add(month);
  return [...set].sort().reverse();
}
