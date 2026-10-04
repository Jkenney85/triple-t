export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR.test(value);
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** Black or white, whichever has the higher WCAG contrast against `hex`. */
export function readableTextColor(hex: string): '#000000' | '#ffffff' {
  if (!isHexColor(hex)) return '#000000';
  const l = relativeLuminance(hex);
  const vsWhite = 1.05 / (l + 0.05);
  const vsBlack = (l + 0.05) / 0.05;
  return vsBlack >= vsWhite ? '#000000' : '#ffffff';
}

export const BANNER_SWATCHES = [
  '#4bce97', '#f5cd47', '#fea362', '#f87168', '#9f8fef', '#579dff', '#6cc3e0', '#94c748', '#e774bb', '#8590a2',
  '#1f845a', '#946f00', '#c25100', '#c9372c', '#6e5dc6', '#0c66e4', '#227d9b', '#5b7f24', '#ae4787', '#44546f',
];

export const LABEL_COLORS = [
  '#4bce97', '#f5cd47', '#fea362', '#f87168', '#9f8fef', '#579dff', '#6cc3e0', '#94c748', '#e774bb', '#8590a2',
  '#216e4e', '#7f5f01', '#a54800', '#ae2e24', '#5e4db2', '#0055cc', '#206a83', '#4c6b1f', '#943d73', '#626f86',
];

export interface BoardTheme {
  id: string;
  name: string;
  background: string;
  /** Representative solid color for the header and theme-color meta tag. */
  base: string;
}

export const BOARD_THEMES: BoardTheme[] = [
  { id: 'ocean', name: 'Ocean', base: '#0c66e4', background: 'linear-gradient(135deg, #0c66e4 0%, #09326c 100%)' },
  { id: 'sunset', name: 'Sunset', base: '#c9372c', background: 'linear-gradient(135deg, #f87168 0%, #9f2a5c 100%)' },
  { id: 'grape', name: 'Grape', base: '#6e5dc6', background: 'linear-gradient(135deg, #8f7ee7 0%, #352c63 100%)' },
  { id: 'forest', name: 'Forest', base: '#1f845a', background: 'linear-gradient(135deg, #22a06b 0%, #164b35 100%)' },
  { id: 'peach', name: 'Peach', base: '#e56910', background: 'linear-gradient(135deg, #fea362 0%, #c25100 100%)' },
  { id: 'lagoon', name: 'Lagoon', base: '#227d9b', background: 'linear-gradient(135deg, #6cc3e0 0%, #1d4f73 100%)' },
  { id: 'bubblegum', name: 'Bubblegum', base: '#ae4787', background: 'linear-gradient(135deg, #e774bb 0%, #6e5dc6 100%)' },
  { id: 'slate', name: 'Slate', base: '#44546f', background: 'linear-gradient(135deg, #626f86 0%, #172b4d 100%)' },
  { id: 'blue', name: 'Blue', base: '#0079bf', background: '#0079bf' },
  { id: 'green', name: 'Green', base: '#519839', background: '#519839' },
  { id: 'orange', name: 'Orange', base: '#d29034', background: '#d29034' },
  { id: 'purple', name: 'Purple', base: '#89609e', background: '#89609e' },
];

export function boardTheme(color: string): BoardTheme {
  const theme = BOARD_THEMES.find((t) => t.id === color);
  if (theme) return theme;
  if (isHexColor(color)) return { id: color, name: 'Custom', base: color, background: color };
  return BOARD_THEMES[0];
}

export const AVATAR_COLORS = ['#0c66e4', '#1f845a', '#c25100', '#ae2e24', '#5e4db2', '#206a83', '#943d73', '#4c6b1f', '#626f86', '#7f5f01'];

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
