import { describe, expect, it } from 'vitest';
import {
  BOARD_THEMES,
  LABEL_COLORS,
  LABEL_GRADIENTS,
  boardBackground,
  boardTheme,
  colorFill,
  gradientValue,
  isBoardColor,
  isLabelColor,
  parseGradientValue,
  readableTextColor,
} from './color';

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

describe('label colors', () => {
  it('accepts solid colors and gradients, nothing else', () => {
    expect(isLabelColor('#4bce97')).toBe(true);
    expect(isLabelColor('gradient:#ff5f6d:#ffc371:90')).toBe(true);
    expect(isLabelColor('ocean')).toBe(false);
    expect(isLabelColor('linear-gradient(90deg, red, blue)')).toBe(false);
    expect([...LABEL_COLORS, ...LABEL_GRADIENTS].every(isLabelColor)).toBe(true);
    expect(new Set([...LABEL_COLORS, ...LABEL_GRADIENTS]).size).toBe(LABEL_COLORS.length + LABEL_GRADIENTS.length);
  });

  it('renders gradients left to right', () => {
    expect(colorFill('gradient:#ff5f6d:#ffc371:90')).toBe('linear-gradient(90deg, #ff5f6d 0%, #ffc371 100%)');
    expect(colorFill('#4bce97')).toBe('#4bce97');
  });

  it('picks text that stays readable across the whole gradient', () => {
    expect(readableTextColor(gradientValue({ from: '#ffffff', to: '#f8e6a0', angle: 90 }))).toBe('#000000');
    expect(readableTextColor(gradientValue({ from: '#000000', to: '#172b4d', angle: 90 }))).toBe('#ffffff');
    // Light-to-dark: black is unreadable on the dark end, white is still fine on mid yellow
    expect(readableTextColor(gradientValue({ from: '#f7971e', to: '#232526', angle: 90 }))).toBe('#ffffff');
  });
});
