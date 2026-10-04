const sameYear = (d: Date) => d.getFullYear() === new Date().getFullYear();

/** "Oct 4" on the card front, "Oct 4, 5:00 PM" in the card detail. */
export function formatDue(ms: number, short = false): string {
  const d = new Date(ms);
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(sameYear(d) ? {} : { year: 'numeric' }) });
  if (short) return date;
  return `${date}, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
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

/** Value for <input type="datetime-local"> in the browser's local time. */
export function toLocalInput(ms: number | null): string {
  if (ms == null) return '';
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
