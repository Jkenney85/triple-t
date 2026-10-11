import { describe, expect, it } from 'vitest';
import { EMPTY_FILTER, cardMatchesFilter } from './filter';
import type { Card } from './types';

const base: Card = {
  id: 1, boardId: 1, columnId: 1, title: 'Waffle maker', notes: 'Supplier notes', bannerColor: '#4bce97', bannerText: 'Viral',
  dayOfWeek: 2, position: 1, dueAt: null, productUrl: '', labelIds: [3], archivedAt: null, createdBy: 1, updatedBy: 1, createdAt: 0, updatedAt: 0,
};
const ctx = { comments: [{ id: 1, cardId: 1, videoId: 7, userId: 1, body: 'sample arrived', createdAt: 0, updatedAt: 0 }], videos: [], now: 1_000_000 };

describe('board filter', () => {
  it('matches text in title, notes, banner and comments', () => {
    for (const text of ['waffle', 'SUPPLIER', 'viral', 'sample']) {
      expect(cardMatchesFilter(base, { ...EMPTY_FILTER, text }, ctx)).toBe(true);
    }
    expect(cardMatchesFilter(base, { ...EMPTY_FILTER, text: 'blender' }, ctx)).toBe(false);
  });

  it('filters by label, day (7 = no day), banner color, due status and videos', () => {
    expect(cardMatchesFilter(base, { ...EMPTY_FILTER, labelIds: [3] }, ctx)).toBe(true);
    expect(cardMatchesFilter(base, { ...EMPTY_FILTER, labelIds: [4] }, ctx)).toBe(false);
    expect(cardMatchesFilter(base, { ...EMPTY_FILTER, days: [2] }, ctx)).toBe(true);
    expect(cardMatchesFilter({ ...base, dayOfWeek: null }, { ...EMPTY_FILTER, days: [7] }, ctx)).toBe(true);
    expect(cardMatchesFilter(base, { ...EMPTY_FILTER, bannerColors: ['#f87168'] }, ctx)).toBe(false);
    expect(cardMatchesFilter(base, { ...EMPTY_FILTER, due: ['none'] }, ctx)).toBe(true);
    expect(cardMatchesFilter({ ...base, dueAt: 500_000 }, { ...EMPTY_FILTER, due: ['overdue'] }, ctx)).toBe(true);
    expect(cardMatchesFilter({ ...base, dueAt: 1_000_000 + 3_600_000 }, { ...EMPTY_FILTER, due: ['soon'] }, ctx)).toBe(true);
    expect(cardMatchesFilter({ ...base, dueAt: 1_000_000 + 5 * 86_400_000 }, { ...EMPTY_FILTER, due: ['soon', 'overdue', 'none'] }, ctx)).toBe(false);
    expect(cardMatchesFilter(base, { ...EMPTY_FILTER, videos: 'with' }, ctx)).toBe(false);
    expect(cardMatchesFilter(base, { ...EMPTY_FILTER, videos: 'without' }, ctx)).toBe(true);
  });
});
