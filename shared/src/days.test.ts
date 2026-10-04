import { describe, expect, it } from 'vitest';
import { appendPosition, computeDropPosition, dayForColumn, dayRank, sortCards, weekdayInTz } from './days';

const card = (id: number, dayOfWeek: number | null, position: number) => ({ id, dayOfWeek, position });

describe('day-of-week sort order', () => {
  it('starts the week on Sunday and puts cards without a day last', () => {
    const cards = [card(1, null, 1), card(2, 6, 1), card(3, 0, 1), card(4, 3, 1), card(5, 1, 1)];
    expect(sortCards(cards).map((c) => c.dayOfWeek)).toEqual([0, 1, 3, 6, null]);
  });

  it('orders cards within the same day by position, then id', () => {
    const cards = [card(1, 2, 300), card(2, 2, 100), card(3, null, 50), card(4, 2, 100), card(5, null, 10)];
    expect(sortCards(cards).map((c) => c.id)).toEqual([2, 4, 1, 5, 3]);
  });

  it('ranks no-day after Saturday', () => {
    expect(dayRank(null)).toBeGreaterThan(dayRank(6));
    expect(dayRank(0)).toBe(0);
  });

  it('does not mutate the input', () => {
    const cards = [card(1, 3, 1), card(2, 0, 1)];
    sortCards(cards);
    expect(cards[0].id).toBe(1);
  });
});

describe('drag drop positions stay inside the card’s own day group', () => {
  // Sun(100), Sun(200), Tue(100), none(100), none(200)
  const others = sortCards([card(1, 0, 100), card(2, 0, 200), card(3, 2, 100), card(4, null, 100), card(5, null, 200)]);

  const resultingOrder = (id: number, day: number | null, index: number) => {
    const position = computeDropPosition(others, index, day);
    return sortCards([...others, card(id, day, position)]).map((c) => c.id);
  };

  it('reorders within the same day group', () => {
    expect(resultingOrder(9, 0, 1)).toEqual([1, 9, 2, 3, 4, 5]);
    expect(resultingOrder(9, 0, 0)).toEqual([9, 1, 2, 3, 4, 5]);
  });

  it('snaps a Sunday card dropped among no-day cards back to the end of the Sunday group', () => {
    expect(resultingOrder(9, 0, 5)).toEqual([1, 2, 9, 3, 4, 5]);
  });

  it('snaps a no-day card dropped at the top to the start of the no-day group', () => {
    expect(resultingOrder(9, null, 0)).toEqual([1, 2, 3, 9, 4, 5]);
  });

  it('places a card into an empty day group in its sorted slot', () => {
    expect(resultingOrder(9, 4, 0)).toEqual([1, 2, 3, 9, 4, 5]);
  });

  it('works in an empty list', () => {
    expect(computeDropPosition([], 0, 3)).toBeTypeOf('number');
  });

  it('appendPosition adds to the end of the day group', () => {
    const position = appendPosition(others, 0);
    expect(sortCards([...others, card(9, 0, position)]).map((c) => c.id)).toEqual([1, 2, 9, 3, 4, 5]);
  });
});

describe('Done column rule', () => {
  it('clears the day when the column is the Done column', () => {
    expect(dayForColumn(3, true)).toBeNull();
    expect(dayForColumn(null, true)).toBeNull();
  });

  it('keeps the day in other columns', () => {
    expect(dayForColumn(3, false)).toBe(3);
    expect(dayForColumn(null, false)).toBeNull();
  });
});

describe('weekdayInTz', () => {
  it('uses the configured time zone, not UTC', () => {
    // 2026-10-05 03:00 UTC is still Sunday evening in Chicago, but Monday in UTC.
    const d = new Date('2026-10-05T03:00:00Z');
    expect(weekdayInTz(d, 'America/Chicago')).toBe(0);
    expect(weekdayInTz(d, 'UTC')).toBe(1);
  });
});
