export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/**
 * Sort rank for a day of week. `firstDay` is the weekday that sorts first
 * (0 = Sunday). The board passes yesterday's weekday so lists roll with the
 * calendar like the Gantt chart. Cards without a day always sort last.
 */
export function dayRank(day: number | null | undefined, firstDay = 0): number {
  return day == null ? 7 : (day - firstDay + 7) % 7;
}

/** Weekday that comes first in the rolling order: yesterday's. */
export const yesterdayWeekday = (todayWeekday: number) => (todayWeekday + 6) % 7;

interface Sortable {
  id: number;
  dayOfWeek: number | null;
  position: number;
}

export function compareCards(a: Sortable, b: Sortable, firstDay = 0): number {
  return dayRank(a.dayOfWeek, firstDay) - dayRank(b.dayOfWeek, firstDay) || a.position - b.position || a.id - b.id;
}

export function sortCards<T extends Sortable>(cards: readonly T[], firstDay = 0): T[] {
  return [...cards].sort((a, b) => compareCards(a, b, firstDay));
}

/** A card dropped in (or moved to) the Done column loses its day of week. */
export function dayForColumn(day: number | null, columnIsDone: boolean): number | null {
  return columnIsDone ? null : day;
}

export const POSITION_GAP = 1024;

/**
 * Position for a card dropped at `insertIndex` of a column's sorted card list
 * (the list must not contain the dragged card). Dragging never changes a
 * card's day, so the drop index is clamped into the card's own day group.
 */
export function computeDropPosition(
  sortedOthers: readonly Sortable[],
  insertIndex: number,
  day: number | null,
  /** Must match the order `sortedOthers` was sorted with. */
  firstDay = 0,
): number {
  const rank = dayRank(day, firstDay);
  let start = sortedOthers.findIndex((c) => dayRank(c.dayOfWeek, firstDay) >= rank);
  if (start === -1) start = sortedOthers.length;
  let end = start;
  while (end < sortedOthers.length && dayRank(sortedOthers[end].dayOfWeek, firstDay) === rank) end++;

  const idx = Math.min(Math.max(insertIndex, start), end);
  const before = idx > start ? sortedOthers[idx - 1] : undefined;
  const after = idx < end ? sortedOthers[idx] : undefined;
  if (before && after) return (before.position + after.position) / 2;
  if (before) return before.position + POSITION_GAP;
  if (after) return after.position - POSITION_GAP;
  return POSITION_GAP;
}

/** Position that appends a card to the end of its day group. */
export function appendPosition(sortedCards: readonly Sortable[], day: number | null): number {
  return computeDropPosition(sortedCards, sortedCards.length, day);
}

/** Day of week (0 = Sunday) for `date` in the given IANA time zone. */
export function weekdayInTz(date: Date, timeZone: string): number {
  const short = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(date);
  return DAY_SHORT.indexOf(short as (typeof DAY_SHORT)[number]);
}

export const COLUMN_SORTS = ['day', 'title', 'due'] as const;

export const COLUMN_SORT_LABELS: Record<(typeof COLUMN_SORTS)[number], string> = {
  day: 'Day of week',
  title: 'A to Z',
  due: 'Due date',
};

const titleCollator = new Intl.Collator('en-US', { sensitivity: 'base', numeric: true });

/**
 * Orders a list's cards by its sort setting. "day" is the original order
 * (day groups, then manual position). "title" is A to Z. "due" puts the
 * soonest due date first and cards without one last. Ties fall back to "day".
 */
export function sortCardsBy<T extends Sortable & { title: string; dueAt: number | null }>(
  cards: readonly T[],
  sort: 'day' | 'title' | 'due',
  firstDay = 0,
): T[] {
  const byDay = (a: T, b: T) => compareCards(a, b, firstDay);
  if (sort === 'title') return [...cards].sort((a, b) => titleCollator.compare(a.title, b.title) || byDay(a, b));
  if (sort === 'due') {
    return [...cards].sort((a, b) => {
      if (a.dueAt == null || b.dueAt == null) return (a.dueAt == null ? 1 : 0) - (b.dueAt == null ? 1 : 0) || byDay(a, b);
      return a.dueAt - b.dueAt || byDay(a, b);
    });
  }
  return sortCards(cards, firstDay);
}
