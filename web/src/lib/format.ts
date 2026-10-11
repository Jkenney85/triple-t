const sameYear = (d: Date) => d.getFullYear() === new Date().getFullYear();

/** Due dates are date-only: "Oct 4" on the card front, "Sun, Oct 4" in the card detail. */
export function formatDue(ms: number, timeZone: string, short = false): string {
  const thisYear = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric' }).format(new Date());
  const year = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric' }).format(new Date(ms));
  return new Date(ms).toLocaleDateString('en-US', {
    timeZone,
    month: 'short',
    day: 'numeric',
    ...(short ? {} : { weekday: 'short' }),
    ...(year === thisYear ? {} : { year: 'numeric' }),
  });
}

export function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear(new Date(ms)) ? {} : { year: 'numeric' }),
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function timeAgo(ms: number): string {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const days = Math.round(h / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return formatDateTime(ms);
}
