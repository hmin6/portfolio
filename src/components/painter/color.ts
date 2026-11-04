/**
 * Color helpers shared by the painter modules.
 *
 * Colors are [red, green, blue] arrays with channels from 0 to 255. Channels
 * can hold fractions while a palette is blending between modes; they are
 * rounded down only when turned into a CSS color string.
 */
export type RGB = [number, number, number];

/** Turns a color into a CSS `rgba()` string. `| 0` drops the fraction. */
export function rgba(color: Readonly<RGB>, alpha = 1): string {
  return `rgba(${color[0] | 0},${color[1] | 0},${color[2] | 0},${alpha})`;
}

/** Blends two colors: k = 0 gives `a`, k = 1 gives `b`, 0.5 is halfway. */
export function mix(a: Readonly<RGB>, b: Readonly<RGB>, k: number): RGB {
  return [
    a[0] + (b[0] - a[0]) * k,
    a[1] + (b[1] - a[1]) * k,
    a[2] + (b[2] - a[2]) * k,
  ];
}

/** Keeps a channel inside the valid 0–255 range. */
export function clamp255(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : value;
}

/** Parses `#rrggbb` (the format globals.css uses). Returns null otherwise. */
export function hexToRgb(hex: string): RGB | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const n = parseInt(match[1], 16);
  // The six hex digits are one 24-bit number: red in the top 8 bits, then
  // green, then blue. Shift each group down and mask off the other bits.
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Reads a color design token such as `--color-aurora` from the page's CSS.
 * Browser only. Falls back if the variable is missing or not `#rrggbb`.
 */
export function readCssColor(name: string, fallback: Readonly<RGB>): RGB {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name);
  const [r, g, b] = fallback;
  return hexToRgb(value) ?? [r, g, b];
}
