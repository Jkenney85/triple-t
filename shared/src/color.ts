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

function contrasts(hex: string) {
  const l = relativeLuminance(hex);
  return { white: 1.05 / (l + 0.05), black: (l + 0.05) / 0.05 };
}

/**
 * Black or white, whichever has the higher WCAG contrast against `color`.
 * For a gradient, picks the text color whose worst contrast across the two ends is best.
 */
export function readableTextColor(color: string): '#000000' | '#ffffff' {
  const g = parseGradientValue(color);
  const stops = g ? [g.from, g.to] : isHexColor(color) ? [color] : [];
  if (stops.length === 0) return '#000000';
  const c = stops.map(contrasts);
  const black = Math.min(...c.map((x) => x.black));
  const white = Math.min(...c.map((x) => x.white));
  return black >= white ? '#000000' : '#ffffff';
}

/** CSS background for a stored color: "#rrggbb" or a "gradient:#from:#to:angle" value. */
export function colorFill(color: string): string {
  const g = parseGradientValue(color);
  return g ? `linear-gradient(${g.angle}deg, ${g.from} 0%, ${g.to} 100%)` : color;
}

/** Labels can be a solid "#rrggbb" or a gradient value. */
export function isLabelColor(value: unknown): value is string {
  return isHexColor(value) || (typeof value === 'string' && parseGradientValue(value) !== null);
}

export const BANNER_SWATCHES = [
  '#4bce97', '#f5cd47', '#fea362', '#f87168', '#9f8fef', '#579dff', '#6cc3e0', '#94c748', '#e774bb', '#8590a2',
  '#1f845a', '#946f00', '#c25100', '#c9372c', '#6e5dc6', '#0c66e4', '#227d9b', '#5b7f24', '#ae4787', '#44546f',
];

/** Colors offered for lists (normal and bold rows). */
export const LIST_COLORS = [
  '#4bce97', '#f5cd47', '#fea362', '#f87168', '#9f8fef', '#579dff', '#6cc3e0', '#94c748', '#e774bb', '#8590a2',
  '#216e4e', '#7f5f01', '#a54800', '#ae2e24', '#5e4db2', '#0055cc', '#206a83', '#4c6b1f', '#943d73', '#626f86',
];

/** Solid label colors: subtle, normal, bold and extra hues, ten per row. */
export const LABEL_COLORS = [
  '#baf3db', '#f8e6a0', '#fedec8', '#ffd5d2', '#dfd8fd', '#cce0ff', '#c6edfb', '#d3f1a7', '#fdd0ec', '#dcdfe4',
  '#4bce97', '#f5cd47', '#fea362', '#f87168', '#9f8fef', '#579dff', '#6cc3e0', '#94c748', '#e774bb', '#8590a2',
  '#216e4e', '#7f5f01', '#a54800', '#ae2e24', '#5e4db2', '#0055cc', '#206a83', '#4c6b1f', '#943d73', '#626f86',
  '#00b8a9', '#ffb703', '#fb5607', '#e63946', '#7209b7', '#3a86ff', '#0096c7', '#2b9348', '#ff006e', '#172b4d',
];

/** Left-to-right gradient presets for labels. */
export const LABEL_GRADIENTS = [
  ['#ff5f6d', '#ffc371'],
  ['#f12711', '#f5af19'],
  ['#f953c6', '#b91d73'],
  ['#fc5c7d', '#6a82fb'],
  ['#e55d87', '#5fc3e4'],
  ['#8e2de2', '#4a00e0'],
  ['#4568dc', '#b06ab3'],
  ['#00c6ff', '#0072ff'],
  ['#2193b0', '#6dd5ed'],
  ['#11998e', '#38ef7d'],
  ['#56ab2f', '#a8e063'],
  ['#f7971e', '#ffd200'],
  ['#ee9ca7', '#ffdde1'],
  ['#bdc3c7', '#2c3e50'],
  ['#232526', '#414345'],
].map(([from, to]) => gradientValue({ from, to, angle: 90 }));

export interface BoardTheme {
  id: string;
  name: string;
  kind: 'gradient' | 'solid';
  background: string;
  /** Representative solid color for the header and theme-color meta tag. */
  base: string;
}

const grad = (id: string, name: string, from: string, to: string, angle = 135): BoardTheme => ({
  id,
  name,
  kind: 'gradient',
  base: mixHex(from, to),
  background: `linear-gradient(${angle}deg, ${from} 0%, ${to} 100%)`,
});
const solid = (id: string, name: string, color: string): BoardTheme => ({ id, name, kind: 'solid', base: color, background: color });

/** Preset backgrounds. Ids are stored on boards, so never rename or remove one. */
export const BOARD_THEMES: BoardTheme[] = [
  grad('ocean', 'Ocean', '#0c66e4', '#09326c'),
  grad('sunset', 'Sunset', '#f87168', '#9f2a5c'),
  grad('grape', 'Grape', '#8f7ee7', '#352c63'),
  grad('forest', 'Forest', '#22a06b', '#164b35'),
  grad('peach', 'Peach', '#fea362', '#c25100'),
  grad('lagoon', 'Lagoon', '#6cc3e0', '#1d4f73'),
  grad('bubblegum', 'Bubblegum', '#e774bb', '#6e5dc6'),
  grad('slate', 'Slate', '#626f86', '#172b4d'),
  grad('aurora', 'Aurora', '#5b4bdb', '#1fb5c4'),
  grad('dusk', 'Dusk', '#2b5876', '#4e4376'),
  grad('ember', 'Ember', '#f12711', '#f5af19'),
  grad('deepsea', 'Deep sea', '#0f2027', '#2c5364'),
  grad('berry', 'Berry', '#8e2de2', '#4a00e0'),
  grad('rose', 'Rose', '#e55d87', '#5fc3e4'),
  grad('cosmic', 'Cosmic', '#ff00cc', '#333399'),
  grad('coral', 'Coral', '#ff5f6d', '#ffc371'),
  grad('sky', 'Sky', '#2980b9', '#6dd5fa'),
  grad('emerald', 'Emerald', '#0f9b8e', '#1d4f3f'),
  grad('candy', 'Candy', '#fc5c7d', '#6a82fb'),
  grad('midnight', 'Midnight', '#232526', '#414345'),
  grad('mojito', 'Mojito', '#1d976c', '#93f9b9'),
  grad('flare', 'Flare', '#f12711', '#c2185b', 160),
  grad('lilac', 'Lilac', '#b06ab3', '#4568dc'),
  grad('sand', 'Sand', '#c79081', '#7b4397'),
  solid('blue', 'Blue', '#0079bf'),
  solid('green', 'Green', '#519839'),
  solid('orange', 'Orange', '#d29034'),
  solid('purple', 'Purple', '#89609e'),
  solid('red', 'Red', '#b04632'),
  solid('pink', 'Pink', '#cd5a91'),
  solid('lime', 'Lime', '#4bbf6b'),
  solid('teal', 'Teal', '#00aecc'),
  solid('gray', 'Gray', '#838c91'),
  solid('navy', 'Navy', '#172b4d'),
];

export interface CustomGradient {
  from: string;
  to: string;
  angle: number;
}

const GRADIENT_VALUE = /^gradient:(#[0-9a-fA-F]{6}):(#[0-9a-fA-F]{6}):(\d{1,3})$/;

/** Custom gradients are stored on the board as "gradient:#from:#to:angle". */
export function gradientValue(g: CustomGradient): string {
  return `gradient:${g.from.toLowerCase()}:${g.to.toLowerCase()}:${Math.round(g.angle) % 360}`;
}

export function parseGradientValue(value: string): CustomGradient | null {
  const m = GRADIENT_VALUE.exec(value);
  if (!m || Number(m[3]) >= 360) return null;
  return { from: m[1].toLowerCase(), to: m[2].toLowerCase(), angle: Number(m[3]) };
}

/** A board's color: a preset id, a "#rrggbb" solid, or a custom gradient value. */
export function isBoardColor(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    (BOARD_THEMES.some((t) => t.id === value) || isHexColor(value) || parseGradientValue(value) !== null)
  );
}

export function mixHex(a: string, b: string): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => Math.round((((pa >> shift) & 255) + ((pb >> shift) & 255)) / 2);
  return `#${[16, 8, 0].map((sh) => ch(sh).toString(16).padStart(2, '0')).join('')}`;
}

export function boardTheme(color: string): BoardTheme {
  const theme = BOARD_THEMES.find((t) => t.id === color);
  if (theme) return theme;
  if (isHexColor(color)) return solid(color, 'Custom', color);
  const g = parseGradientValue(color);
  if (g) return grad(color, 'Custom', g.from, g.to, g.angle);
  return BOARD_THEMES[0];
}

/**
 * CSS `background` for a board. A photo is layered over the color theme,
 * which shows while the image loads (and if it ever fails).
 */
export function boardBackground(board: { color: string; backgroundImage: string | null }, size: 'full' | 'thumb' = 'full'): string {
  const theme = boardTheme(board.color);
  if (!board.backgroundImage) return theme.background;
  const url = size === 'thumb' ? board.backgroundImage.replace(/\.webp$/, '-thumb.webp') : board.backgroundImage;
  return `url("${url}") center / cover no-repeat, ${theme.background}`;
}

export const AVATAR_COLORS = ['#0c66e4', '#1f845a', '#c25100', '#ae2e24', '#5e4db2', '#206a83', '#943d73', '#4c6b1f', '#626f86', '#7f5f01'];

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
