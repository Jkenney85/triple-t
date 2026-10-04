export type DueStatus = 'none' | 'overdue' | 'soon' | 'later';

export const DAY_MS = 24 * 60 * 60 * 1000;

export function dueStatus(dueAt: number | null | undefined, now: number = Date.now()): DueStatus {
  if (dueAt == null) return 'none';
  if (dueAt < now) return 'overdue';
  if (dueAt - now <= DAY_MS) return 'soon';
  return 'later';
}
