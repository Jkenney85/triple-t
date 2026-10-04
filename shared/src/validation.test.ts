import { describe, expect, it } from 'vitest';
import { readableTextColor } from './color';
import { isTikTokImageUrl, isTikTokUrl } from './tiktok';
import { validateCardInput, validateFieldValue } from './validation';

describe('required-field validation', () => {
  it('requires a title when creating a card', () => {
    const r = validateCardInput({});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.title).toMatch(/required/i);
  });

  it('rejects a whitespace-only title', () => {
    expect(validateCardInput({ title: '   ' }).ok).toBe(false);
  });

  it('accepts a card with only a title (notes and labels are optional)', () => {
    const r = validateCardInput({ title: '  Mini fan ' });
    expect(r).toEqual({ ok: true, value: { title: 'Mini fan' } });
  });

  it('only checks the title on a partial update when the title is included', () => {
    expect(validateCardInput({ notes: 'hello' }, { partial: true }).ok).toBe(true);
    expect(validateCardInput({ title: '' }, { partial: true }).ok).toBe(false);
  });

  it('validates the other card fields', () => {
    expect(validateCardInput({ title: 'x', dayOfWeek: 7 }).ok).toBe(false);
    expect(validateCardInput({ title: 'x', dayOfWeek: null }).ok).toBe(true);
    expect(validateCardInput({ title: 'x', bannerColor: 'red' }).ok).toBe(false);
    expect(validateCardInput({ title: 'x', bannerColor: '#AABBCC' })).toEqual({ ok: true, value: { title: 'x', bannerColor: '#aabbcc' } });
    expect(validateCardInput({ title: 'x', productUrl: 'javascript:alert(1)' }).ok).toBe(false);
    expect(validateCardInput({ title: 'x', productUrl: 'https://shop.tiktok.com/p/1' }).ok).toBe(true);
    expect(validateCardInput({ title: 'x', labelIds: [1, 1, 2] })).toEqual({ ok: true, value: { title: 'x', labelIds: [1, 2] } });
    expect(validateCardInput({ title: 'x', labelIds: ['a'] }).ok).toBe(false);
  });

  it('validates metric values by field type', () => {
    expect(validateFieldValue('number', '1,200')).toEqual({ ok: true, value: '1200' });
    expect(validateFieldValue('currency', '$5.50')).toEqual({ ok: true, value: '5.5' });
    expect(validateFieldValue('number', 'lots').ok).toBe(false);
    expect(validateFieldValue('date', '2026-10-04').ok).toBe(true);
    expect(validateFieldValue('date', 'tomorrow').ok).toBe(false);
    expect(validateFieldValue('url', 'ftp://x').ok).toBe(false);
    expect(validateFieldValue('number', '')).toEqual({ ok: true, value: '' });
  });
});

describe('banner text contrast', () => {
  it('uses black text on light colors and white on dark ones', () => {
    expect(readableTextColor('#f5cd47')).toBe('#000000');
    expect(readableTextColor('#ffffff')).toBe('#000000');
    expect(readableTextColor('#0c66e4')).toBe('#ffffff');
    expect(readableTextColor('#000000')).toBe('#ffffff');
  });
});

describe('TikTok URL allowlist (SSRF guard)', () => {
  it('accepts TikTok video and short links', () => {
    expect(isTikTokUrl('https://www.tiktok.com/@user/video/123')).toBe(true);
    expect(isTikTokUrl('https://vm.tiktok.com/ZMabc/')).toBe(true);
    expect(isTikTokUrl('https://tiktok.com/t/abc')).toBe(true);
  });

  it('rejects other hosts and lookalikes', () => {
    expect(isTikTokUrl('https://tiktok.com.evil.example/x')).toBe(false);
    expect(isTikTokUrl('https://eviltiktok.com/x')).toBe(false);
    expect(isTikTokUrl('http://169.254.169.254/latest')).toBe(false);
    expect(isTikTokUrl('https://user:pw@www.tiktok.com/x')).toBe(false);
    expect(isTikTokUrl('https://www.tiktok.com:8080/x')).toBe(false);
    expect(isTikTokUrl('file:///etc/passwd')).toBe(false);
  });

  it('only allows https TikTok CDN hosts for thumbnails', () => {
    expect(isTikTokImageUrl('https://p16-sign-va.tiktokcdn.com/obj/x.jpeg')).toBe(true);
    expect(isTikTokImageUrl('http://p16-sign-va.tiktokcdn.com/obj/x.jpeg')).toBe(false);
    expect(isTikTokImageUrl('https://example.com/x.jpeg')).toBe(false);
  });
});
