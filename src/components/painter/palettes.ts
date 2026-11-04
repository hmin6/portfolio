import { readCssColor, type RGB } from "./color";

/** The three lighting modes the hero can show. */
export type ModeId = "night" | "golden" | "day";

export interface ModeInfo {
  id: ModeId;
  /** Text on the mode button. */
  label: string;
  /** Alt text for the painting in this mode. */
  description: string;
}

export const MODES: readonly ModeInfo[] = [
  {
    id: "night",
    label: "Night",
    description:
      "A painting of a Venetian canal at night under green and violet aurora, with lit windows, a gondola, and floating lanterns, drawn in brushstrokes.",
  },
  {
    id: "golden",
    label: "Golden hour",
    description:
      "A painting of a Venetian canal at golden hour, with a low sun glowing over the water and a gondola, drawn in brushstrokes.",
  },
  {
    id: "day",
    label: "Day",
    description:
      "A painting of a Venetian canal on a bright day, with blue sky, terracotta buildings, and a gondola, drawn in brushstrokes.",
  },
];

/*
 * A palette describes one mode of the scene.
 *
 * Colors:
 *   skyTop, skyHorizon  sky gradient, top to horizon
 *   distant             far skyline silhouette
 *   wall, wall2         left and right building walls
 *   windowDark          unlit windows
 *   windowLit           lit windows, mixed in by `windowLight`
 *   waterTint           tint laid over the reflected sky
 *   sunColor            sun disc
 *   underpaint          base color the canvas is filled with before strokes
 *   boat                gondola and its shadow
 *   stripe, pole        mooring poles
 *
 * Amounts:
 *   windowLight  0–1, how lit the windows and lamps are
 *   aurora       0–1, aurora strength
 *   sun          0–1, sun strength
 *   sunX, sunY   sun position as a fraction of the scene's width and height
 *   stars        0–1, star brightness
 *   rimLight     0–1, aurora light on the buildings (edges, rooflines,
 *                upper walls) and on the water around the gondola
 *
 * The key lists come first and the Palette type is built from them, so the
 * blend in `lerpPalette` covers every key, and TypeScript rejects a palette
 * with a missing or extra key.
 */
const COLOR_KEYS = [
  "skyTop",
  "skyHorizon",
  "distant",
  "wall",
  "wall2",
  "windowDark",
  "windowLit",
  "waterTint",
  "sunColor",
  "underpaint",
  "boat",
  "stripe",
  "pole",
] as const;

const AMOUNT_KEYS = [
  "windowLight",
  "aurora",
  "sun",
  "sunX",
  "sunY",
  "stars",
  "rimLight",
] as const;

type ColorKey = (typeof COLOR_KEYS)[number];
type AmountKey = (typeof AMOUNT_KEYS)[number];

/** The palette the engine blends and draws with. Its values change. */
export type Palette = Record<ColorKey, RGB> & Record<AmountKey, number>;

/** A palette that can't be changed, used for the constants below. */
export type ReadonlyPalette = { readonly [K in ColorKey]: Readonly<RGB> } & {
  readonly [K in AmountKey]: number;
};

/** The two building wall colors, so a building can say which one it uses. */
export type WallKey = "wall" | "wall2";

export const PALETTES: Readonly<Record<ModeId, ReadonlyPalette>> = {
  night: {
    skyTop: [4, 7, 26],
    skyHorizon: [30, 40, 100],
    distant: [10, 14, 42],
    // A step lighter than the darkest sky, so the buildings don't dissolve
    // into it; drawBuildings adds aurora light along their tops.
    wall: [40, 34, 74],
    wall2: [46, 39, 82],
    windowDark: [20, 24, 54],
    windowLit: [246, 196, 118],
    waterTint: [3, 6, 22],
    sunColor: [255, 214, 150],
    underpaint: [46, 30, 26],
    boat: [5, 7, 24],
    stripe: [170, 140, 90],
    pole: [30, 30, 64],
    windowLight: 1,
    aurora: 1,
    sun: 0,
    sunX: 0.63,
    sunY: 0.47,
    stars: 1,
    rimLight: 0.5,
  },
  golden: {
    skyTop: [52, 44, 104],
    skyHorizon: [250, 170, 98],
    distant: [86, 52, 78],
    wall: [118, 58, 50],
    wall2: [146, 84, 62],
    windowDark: [74, 42, 44],
    windowLit: [255, 210, 140],
    waterTint: [48, 30, 58],
    sunColor: [255, 222, 160],
    underpaint: [70, 40, 30],
    boat: [30, 18, 26],
    stripe: [230, 200, 150],
    pole: [60, 36, 44],
    windowLight: 0.55,
    aurora: 0,
    sun: 1,
    sunX: 0.66,
    sunY: 0.4,
    stars: 0.1,
    rimLight: 0.05,
  },
  day: {
    skyTop: [64, 128, 204],
    skyHorizon: [200, 230, 240],
    distant: [128, 150, 178],
    wall: [200, 118, 80],
    wall2: [224, 188, 140],
    windowDark: [58, 96, 84],
    windowLit: [255, 240, 210],
    waterTint: [28, 112, 138],
    sunColor: [255, 250, 230],
    underpaint: [120, 90, 60],
    boat: [24, 24, 34],
    stripe: [238, 238, 238],
    pole: [38, 74, 140],
    windowLight: 0,
    aurora: 0,
    sun: 0.75,
    sunX: 0.74,
    sunY: 0.14,
    stars: 0,
    rimLight: 0,
  },
};

/** A deep copy the engine can blend without touching the constants. */
export function clonePalette(palette: ReadonlyPalette): Palette {
  // structuredClone copies the nested color arrays too. The cast only drops
  // `readonly`: the copy is ours to change.
  return structuredClone(palette) as Palette;
}

/**
 * Moves every value in `current` a fraction `k` of the way toward `target`.
 * Called every frame, this eases quickly at first and then slows as it gets
 * close (exponential smoothing), so mode changes fade instead of jumping.
 */
export function lerpPalette(
  current: Palette,
  target: ReadonlyPalette,
  k: number,
): void {
  for (const key of COLOR_KEYS) {
    const c = current[key];
    const t = target[key];
    c[0] += (t[0] - c[0]) * k;
    c[1] += (t[1] - c[1]) * k;
    c[2] += (t[2] - c[2]) * k;
  }
  for (const key of AMOUNT_KEYS) {
    current[key] += (target[key] - current[key]) * k;
  }
}

/**
 * True once `current` has finished blending toward `target`: every color
 * channel within 2 of its target (on the 0–255 scale), and every amount
 * within 2/255. Scaling amounts to the same range lets one threshold work
 * for both.
 */
export function isPaletteSettled(current: Palette, target: ReadonlyPalette): boolean {
  const limit = 2;
  for (const key of COLOR_KEYS) {
    const c = current[key];
    const t = target[key];
    if (
      Math.abs(c[0] - t[0]) > limit ||
      Math.abs(c[1] - t[1]) > limit ||
      Math.abs(c[2] - t[2]) > limit
    ) {
      return false;
    }
  }
  for (const key of AMOUNT_KEYS) {
    if (Math.abs(current[key] - target[key]) * 255 > limit) return false;
  }
  return true;
}

/*
 * Fixed scene colors that don't change with the mode and aren't UI tokens.
 */

/** Lamp, window, and lantern glow. Brass reads as dull gold next to lamplight. */
export const WARM_GLOW: Readonly<RGB> = [255, 200, 120];
/** Sun glints on the water. */
export const WHITE_GLOW: Readonly<RGB> = [235, 240, 255];
/** Lighter violet at the base of the top aurora curtain. */
export const LIGHT_VIOLET: Readonly<RGB> = [167, 139, 250];

/**
 * Design tokens from globals.css that the painter shares with the UI, so the
 * aurora on the canvas matches the aurora green of buttons and focus rings.
 */
export interface ThemeColors {
  aurora: RGB;
  teal: RGB;
  violet: RGB;
  magenta: RGB;
  starlight: RGB;
}

/** Same values as globals.css, used if a variable can't be read. */
const THEME_FALLBACKS: { readonly [K in keyof ThemeColors]: Readonly<RGB> } = {
  aurora: [61, 255, 176],
  teal: [45, 212, 191],
  violet: [139, 92, 246],
  magenta: [232, 121, 249],
  starlight: [232, 236, 248],
};

/** Reads the shared tokens from the page's CSS. Browser only. */
export function readThemeColors(): ThemeColors {
  return {
    aurora: readCssColor("--color-aurora", THEME_FALLBACKS.aurora),
    teal: readCssColor("--color-teal", THEME_FALLBACKS.teal),
    violet: readCssColor("--color-violet", THEME_FALLBACKS.violet),
    magenta: readCssColor("--color-magenta", THEME_FALLBACKS.magenta),
    starlight: readCssColor("--color-starlight", THEME_FALLBACKS.starlight),
  };
}
