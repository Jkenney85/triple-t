import type { FieldType, TotalMode } from './types';

export const FIELD_TYPES: FieldType[] = ['number', 'percent', 'currency', 'text', 'url', 'date'];
export const NUMERIC_TYPES: FieldType[] = ['number', 'percent', 'currency'];

export function isNumericType(type: FieldType): boolean {
  return NUMERIC_TYPES.includes(type);
}

export function defaultTotalMode(type: FieldType): TotalMode {
  if (type === 'number' || type === 'currency') return 'sum';
  if (type === 'percent') return 'avg';
  return 'none';
}

/** Parses user-entered numbers like "1,234", "$5.99" or "3.2%". Returns null if blank or invalid. */
export function parseNumeric(value: string | null | undefined): number | null {
  if (value == null) return null;
  const cleaned = String(value).replace(/[\s,$%]/g, '');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Total of a field across a card's videos, or null when there is nothing to total. */
export function computeTotal(
  field: { type: FieldType; totalMode: TotalMode },
  values: ReadonlyArray<string | null | undefined>,
): number | null {
  if (field.totalMode === 'none' || !isNumericType(field.type)) return null;
  const nums = values.map(parseNumeric).filter((n): n is number => n !== null);
  if (nums.length === 0) return null;
  const sum = nums.reduce((a, b) => a + b, 0);
  return field.totalMode === 'sum' ? sum : sum / nums.length;
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const usdCompact = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
});
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const plain = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

export function formatNumber(type: FieldType, n: number, opts: { compact?: boolean } = {}): string {
  if (type === 'currency') return opts.compact && Math.abs(n) >= 10000 ? usdCompact.format(n) : usd.format(n);
  if (type === 'percent') return `${plain.format(n)}%`;
  return opts.compact && Math.abs(n) >= 10000 ? compact.format(n) : plain.format(n);
}
