import { dueStatus, type DueStatus } from './due';
import type { Card, Comment, Video } from './types';

export interface CardFilter {
  text: string;
  labelIds: number[];
  /** 0–6, or 7 for "no day". */
  days: number[];
  bannerColors: string[];
  due: Exclude<DueStatus, 'later'>[];
  videos: 'any' | 'with' | 'without';
}

export const EMPTY_FILTER: CardFilter = { text: '', labelIds: [], days: [], bannerColors: [], due: [], videos: 'any' };

export function activeFilterCount(f: CardFilter): number {
  return (
    (f.text.trim() ? 1 : 0) +
    (f.labelIds.length ? 1 : 0) +
    (f.days.length ? 1 : 0) +
    (f.bannerColors.length ? 1 : 0) +
    (f.due.length ? 1 : 0) +
    (f.videos !== 'any' ? 1 : 0)
  );
}

export function cardMatchesFilter(
  card: Card,
  f: CardFilter,
  ctx: { comments: readonly Comment[]; videos: readonly Video[]; now?: number },
): boolean {
  const q = f.text.trim().toLowerCase();
  if (q) {
    const hay = [card.title, card.notes, card.bannerText, ...ctx.comments.map((c) => c.body)].join('\n').toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (f.labelIds.length && !f.labelIds.some((id) => card.labelIds.includes(id))) return false;
  if (f.days.length && !f.days.includes(card.dayOfWeek ?? 7)) return false;
  if (f.bannerColors.length && !(card.bannerColor && f.bannerColors.includes(card.bannerColor))) return false;
  if (f.due.length) {
    const s = dueStatus(card.dueAt, ctx.now);
    if (s === 'later' || !f.due.includes(s)) return false;
  }
  if (f.videos === 'with' && ctx.videos.length === 0) return false;
  if (f.videos === 'without' && ctx.videos.length > 0) return false;
  return true;
}
