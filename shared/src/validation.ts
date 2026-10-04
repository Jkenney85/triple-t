import { isHexColor } from './color';
import { parseNumeric } from './totals';
import type { FieldType } from './types';

export interface CardInput {
  title?: string;
  notes?: string;
  bannerColor?: string | null;
  bannerText?: string;
  dayOfWeek?: number | null;
  dueAt?: number | null;
  productUrl?: string;
  labelIds?: number[];
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: Record<string, string> };

export const LIMITS = {
  title: 300,
  notes: 50_000,
  bannerText: 80,
  url: 2048,
  comment: 10_000,
  name: 80,
  fieldValue: 500,
};

export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validates and normalizes card input. Only the title is required (on create,
 * or whenever a patch includes it). With `partial`, absent keys are left out.
 */
export function validateCardInput(input: unknown, opts: { partial?: boolean } = {}): ValidationResult<CardInput> {
  const errors: Record<string, string> = {};
  const value: CardInput = {};
  const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const has = (k: string) => Object.prototype.hasOwnProperty.call(src, k) && src[k] !== undefined;

  if (has('title') || !opts.partial) {
    const title = typeof src.title === 'string' ? src.title.trim() : '';
    if (!title) errors.title = 'Title is required';
    else if (title.length > LIMITS.title) errors.title = `Title must be ${LIMITS.title} characters or fewer`;
    else value.title = title;
  }

  if (has('notes')) {
    if (typeof src.notes !== 'string') errors.notes = 'Notes must be text';
    else if (src.notes.length > LIMITS.notes) errors.notes = 'Notes are too long';
    else value.notes = src.notes;
  }

  if (has('bannerColor')) {
    if (src.bannerColor === null || src.bannerColor === '') value.bannerColor = null;
    else if (isHexColor(src.bannerColor)) value.bannerColor = src.bannerColor.toLowerCase();
    else errors.bannerColor = 'Banner color must be a hex color like #4bce97';
  }

  if (has('bannerText')) {
    if (typeof src.bannerText !== 'string') errors.bannerText = 'Banner text must be text';
    else if (src.bannerText.trim().length > LIMITS.bannerText) errors.bannerText = `Banner text must be ${LIMITS.bannerText} characters or fewer`;
    else value.bannerText = src.bannerText.trim();
  }

  if (has('dayOfWeek')) {
    const d = src.dayOfWeek;
    if (d === null) value.dayOfWeek = null;
    else if (typeof d === 'number' && Number.isInteger(d) && d >= 0 && d <= 6) value.dayOfWeek = d;
    else errors.dayOfWeek = 'Day of week must be 0 (Sunday) through 6 (Saturday)';
  }

  if (has('dueAt')) {
    const d = src.dueAt;
    if (d === null) value.dueAt = null;
    else if (typeof d === 'number' && Number.isFinite(d)) value.dueAt = Math.round(d);
    else errors.dueAt = 'Due date is invalid';
  }

  if (has('productUrl')) {
    const url = typeof src.productUrl === 'string' ? src.productUrl.trim() : null;
    if (url === null) errors.productUrl = 'Product link must be text';
    else if (url === '') value.productUrl = '';
    else if (url.length > LIMITS.url || !isHttpUrl(url)) errors.productUrl = 'Product link must be an http(s) URL';
    else value.productUrl = url;
  }

  if (has('labelIds')) {
    const ids = src.labelIds;
    if (!Array.isArray(ids) || !ids.every((id) => Number.isInteger(id) && id > 0)) errors.labelIds = 'Labels are invalid';
    else value.labelIds = [...new Set(ids as number[])];
  }

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value };
}

/** Validates one metric value entered on a video. Empty clears the value. */
export function validateFieldValue(type: FieldType, raw: unknown): ValidationResult<string> {
  const value = typeof raw === 'string' ? raw.trim() : raw == null ? '' : String(raw);
  if (value === '') return { ok: true, value: '' };
  if (value.length > LIMITS.fieldValue) return { ok: false, errors: { value: 'Value is too long' } };
  switch (type) {
    case 'number':
    case 'percent':
    case 'currency': {
      const n = parseNumeric(value);
      return n === null ? { ok: false, errors: { value: 'Enter a number' } } : { ok: true, value: String(n) };
    }
    case 'url':
      return isHttpUrl(value) ? { ok: true, value } : { ok: false, errors: { value: 'Enter an http(s) URL' } };
    case 'date':
      return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))
        ? { ok: true, value }
        : { ok: false, errors: { value: 'Enter a date as YYYY-MM-DD' } };
    default:
      return { ok: true, value };
  }
}
