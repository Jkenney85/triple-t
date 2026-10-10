import { describe, expect, it } from 'vitest';
import { BOARD_THEMES, boardBackground, boardTheme, gradientValue, isBoardColor, parseGradientValue } from './color';

describe('board backgrounds', () => {
  it('round-trips custom gradients', () => {
    const v = gradientValue({ from: '#AA0000', to: '#0000bb', angle: 90 });
    expect(v).toBe('gradient:#aa0000:#0000bb:90');
    expect(parseGradientValue(v)).toEqual({ from: '#aa0000', to: '#0000bb', angle: 90 });
    expect(boardTheme(v).background).toBe('linear-gradient(90deg, #aa0000 0%, #0000bb 100%)');
    expect(boardTheme(v).base).toBe('#55005e');
  });

  it('accepts presets, hex colors and custom gradients only', () => {
    expect(isBoardColor('ocean')).toBe(true);
    expect(isBoardColor('#123abc')).toBe(true);
    expect(isBoardColor('gradient:#000000:#ffffff:135')).toBe(true);
    expect(isBoardColor('gradient:#000000:#ffffff:360')).toBe(false);
    expect(isBoardColor('gradient:red:blue:90')).toBe(false);
    expect(isBoardColor('url(https://evil.example/x.png)')).toBe(false);
    expect(isBoardColor('nope')).toBe(false);
  });

  it('keeps preset ids unique', () => {
    expect(new Set(BOARD_THEMES.map((t) => t.id)).size).toBe(BOARD_THEMES.length);
  });

  it('layers a photo over the color, using the thumbnail for previews', () => {
    const board = { color: 'ocean', backgroundImage: '/api/backgrounds/b1-0123456789ab.webp' };
    expect(boardBackground(board)).toMatch(/^url\("\/api\/backgrounds\/b1-0123456789ab\.webp"\) center \/ cover no-repeat, linear-gradient/);
    expect(boardBackground(board, 'thumb')).toContain('b1-0123456789ab-thumb.webp');
    expect(boardBackground({ color: '#112233', backgroundImage: null })).toBe('#112233');
  });
});
