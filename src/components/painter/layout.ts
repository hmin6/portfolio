import type { WallKey } from "./palettes";

/*
 * Two coordinate systems:
 *
 * - The visible canvases are measured in device pixels (`width`, `height`).
 * - The hidden scene is a small picture, 360 or 220 pixels wide, measured in
 *   scene pixels (`sceneW`, `sceneH`). All geometry below is in scene pixels.
 *
 * Brushstrokes sample the small scene and paint onto the big canvas, so the
 * scene only needs enough detail for color, not for sharp edges.
 */
export interface Viewport {
  /** Visible canvas size in device pixels. */
  width: number;
  height: number;
  /** Device pixels per CSS pixel, capped at MAX_DPR. */
  dpr: number;
  /** Hidden scene size in scene pixels. */
  sceneW: number;
  sceneH: number;
  /** Row of the horizon (where sky meets water), in scene pixels. */
  horizon: number;
  /** Narrow screens use a smaller scene and smaller strokes. */
  narrow: boolean;
}

/**
 * Pixel-ratio cap. A 3× phone screen would need 9× the pixels of a 1× screen
 * to fill; strokes are soft anyway, so 1.5× keeps them crisp enough while
 * keeping the per-frame cost reasonable.
 */
const MAX_DPR = 1.5;
const NARROW_BREAKPOINT = 700;

export function createViewport(
  cssWidth: number,
  cssHeight: number,
  devicePixelRatio: number,
): Viewport {
  const w = Math.max(1, cssWidth);
  const h = Math.max(1, cssHeight);
  const dpr = Math.min(devicePixelRatio || 1, MAX_DPR);
  const narrow = w < NARROW_BREAKPOINT;
  const sceneW = narrow ? 220 : 360;
  // Same aspect ratio as the hero, so scene pixels map to square areas.
  const sceneH = Math.max(120, Math.round((sceneW * h) / w));
  return {
    width: Math.max(1, Math.round(w * dpr)),
    height: Math.max(1, Math.round(h * dpr)),
    dpr,
    sceneW,
    sceneH,
    horizon: Math.round(sceneH * 0.53),
    narrow,
  };
}

/** An axis-aligned box. Which pixels (scene or device) depends on the caller. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Building {
  x0: number;
  x1: number;
  top: number;
  /** Waterline. */
  base: number;
  wall: WallKey;
  cols: number;
  rows: number;
  /** Which windows are lit, counted row by row from the top left. */
  lit: readonly number[];
  /** Chimney positions as fractions of the building's width. */
  chimneys: readonly number[];
}

/** Named SceneWindow because `Window` is the browser's global type. */
export interface SceneWindow {
  building: number;
  cx: number;
  y: number;
  w: number;
  h: number;
  lit: boolean;
  /** Random phase so the windows don't all flicker in step. */
  seed: number;
}

export interface Gondola {
  x: number;
  y: number;
  length: number;
  /** Lamp position, updated by drawScene as the boat bobs. */
  lampX: number;
  lampY: number;
}

export interface Bridge {
  x0: number;
  x1: number;
  y: number;
}

export interface Pole {
  x: number;
  top: number;
  bottom: number;
}

export interface DistantLight {
  x: number;
  y: number;
  seed: number;
}

/** Stars are stored as fractions (0–1) of the canvas, not scene pixels. */
export interface Star {
  x: number;
  y: number;
  r: number;
  seed: number;
}

export interface SceneLayout {
  buildings: Building[];
  windows: SceneWindow[];
  gondola: Gondola;
  bridge: Bridge;
  poles: Pole[];
  distantLights: DistantLight[];
  stars: Star[];
}

/** Places everything in the scene. Rebuilt whenever the hero is resized. */
export function createLayout(view: Viewport): SceneLayout {
  const { sceneW: SW, sceneH: SH, horizon: hy } = view;
  // Wide screens get narrower buildings so the canal stays open in the middle.
  const wide = SW / SH > 1.3;
  // Tall (portrait phone) screens: the text covers the lower third of the
  // hero, so the gondola moves up toward the horizon to stay in view.
  const tall = SW / SH < 0.8;
  const leftW = SW * (wide ? 0.2 : 0.26);
  const rightW = SW * (wide ? 0.17 : 0.22);

  const buildings: Building[] = [
    {
      x0: 0,
      x1: leftW,
      top: SH * 0.14,
      base: SH * 0.67,
      wall: "wall",
      cols: 4,
      rows: 3,
      lit: [1, 7, 8, 10],
      chimneys: [0.3, 0.62],
    },
    {
      x0: SW - rightW,
      x1: SW,
      top: SH * 0.22,
      base: SH * 0.66,
      wall: "wall2",
      cols: 4,
      rows: 3,
      lit: [1, 7, 8],
      chimneys: [0.45],
    },
  ];

  const windows: SceneWindow[] = [];
  buildings.forEach((b, bi) => {
    const bw = b.x1 - b.x0;
    const bh = b.base - b.top;
    const ww = bw / (b.cols * 2.1);
    const wh = Math.min(bh * 0.17, ww * 2.3);
    for (let r = 0; r < b.rows; r++) {
      for (let c = 0; c < b.cols; c++) {
        windows.push({
          building: bi,
          cx: b.x0 + bw * ((c + 0.5) / b.cols),
          y: b.top + bh * (0.1 + r * 0.26),
          w: ww,
          h: wh,
          lit: b.lit.includes(r * b.cols + c),
          seed: Math.random() * 10,
        });
      }
    }
  });

  const distantLights: DistantLight[] = [];
  for (let i = 0; i < 14; i++) {
    distantLights.push({
      x: SW * (0.24 + Math.random() * 0.55),
      y: hy - SH * (0.004 + Math.random() * 0.02),
      seed: Math.random() * 10,
    });
  }

  const stars: Star[] = [];
  for (let i = 0; i < 70; i++) {
    stars.push({
      x: Math.random(),
      y: Math.random() * 0.42,
      r: 0.6 + Math.random() * 1.1,
      seed: Math.random() * 10,
    });
  }

  return {
    buildings,
    windows,
    gondola: {
      x: SW * (wide ? 0.58 : 0.52),
      y: SH * (tall ? 0.6 : 0.75),
      length: SW * (wide ? 0.22 : 0.34),
      lampX: 0,
      lampY: 0,
    },
    bridge: { x0: leftW, x1: leftW + SW * 0.12, y: hy + SH * 0.045 },
    poles: [0.73, 0.755, 0.78].map((f, i) => ({
      x: SW * (wide ? f : f - 0.06),
      top: hy + SH * (0.01 + i * 0.012),
      bottom: SH * 0.8,
    })),
    distantLights,
    stars,
  };
}

/** How far the aurora reaches in one scene column, filled in by drawScene. */
export interface AuroraColumn {
  top: number;
  bottom: number;
  strength: number;
}

/** One entry per scene column; null where there's no aurora. */
export type AuroraBand = (AuroraColumn | null)[];

/**
 * What a scene pixel shows, which decides the brushstroke's shape.
 *
 * A plain object with `as const` instead of a TypeScript `enum`: it is
 * ordinary JavaScript, and the type below (declared with the same name)
 * is the union 0 | 1 | 2 | 3, so `Region` works as both values and a type.
 */
export const Region = {
  /** Open sky: loose, swirling strokes. */
  Sky: 0,
  /** Buildings, boat, poles, skyline: short dabs. */
  Solid: 1,
  /** Canal: long, flat strokes. */
  Water: 2,
  /** Aurora curtains: tall vertical streaks. */
  Aurora: 3,
} as const;
export type Region = (typeof Region)[keyof typeof Region];

/** Classifies the scene pixel at (sx, sy). Checked in order: first match wins. */
export function regionAt(
  layout: SceneLayout,
  view: Viewport,
  band: AuroraBand,
  sx: number,
  sy: number,
): Region {
  const { sceneW: SW, sceneH: SH, horizon: hy } = view;
  const g = layout.gondola;
  const L = g.length;
  if (Math.abs(sx - g.x) < L * 0.56 && sy > g.y - L * 0.27 && sy < g.y + L * 0.08) {
    return Region.Solid;
  }
  for (const b of layout.buildings) {
    // Extends above the roof to cover the chimneys.
    if (sx >= b.x0 && sx <= b.x1 && sy >= b.top - SH * 0.08 && sy <= b.base) {
      return Region.Solid;
    }
  }
  for (const p of layout.poles) {
    if (Math.abs(sx - p.x) < 2.5 && sy >= p.top && sy <= p.bottom) {
      return Region.Solid;
    }
  }
  if (sy >= hy) return Region.Water;
  // The distant skyline: a thin band just above the horizon.
  if (sy > hy - SH * 0.06 && sx > SW * 0.21 && sx < SW * 0.81) {
    return Region.Solid;
  }
  const column = band[sx];
  if (column && column.strength > 0.12 && sy >= column.top && sy <= column.bottom) {
    return Region.Aurora;
  }
  return Region.Sky;
}
