export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** Sort rank for a day of week. The week starts Sunday; cards without a day sort last. */
export function dayRank(day: number | null | undefined): number {
  return day == null ? 7 : day;
}

interface Sortable {
  id: number;
  dayOfWeek: number | null;
  position: number;
}

export function compareCards(a: Sortable, b: Sortable): number {
  return dayRank(a.dayOfWeek) - dayRank(b.dayOfWeek) || a.position - b.position || a.id - b.id;
}

export function sortCards<T extends Sortable>(cards: readonly T[]): T[] {
  return [...cards].sort(compareCards);
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
): number {
  const rank = dayRank(day);
  let start = sortedOthers.findIndex((c) => dayRank(c.dayOfWeek) >= rank);
  if (start === -1) start = sortedOthers.length;
  let end = start;
  while (end < sortedOthers.length && dayRank(sortedOthers[end].dayOfWeek) === rank) end++;

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
