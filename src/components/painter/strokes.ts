import { clamp255 } from "./color";
import {
  Region,
  regionAt,
  type AuroraBand,
  type Rect,
  type SceneLayout,
  type Viewport,
} from "./layout";

export interface StrokeInput {
  /** Context of the visible paint canvas. */
  ctx: CanvasRenderingContext2D;
  view: Viewport;
  layout: SceneLayout;
  band: AuroraBand;
  /** The hidden scene's pixels this frame, from getImageData. */
  pixels: Uint8ClampedArray;
  /** Animation time in seconds. */
  t: number;
  /**
   * Where strokes may land, in device pixels. Defaults to the whole canvas.
   * A small area repaints one spot, like a lantern added while paused.
   */
  area?: Rect;
}

/**
 * Paints `count` brushstrokes onto the visible canvas. Each stroke:
 *
 * 1. lands at a random point and takes its color from the matching pixel
 *    of the hidden scene, with a little random variation, like real paint;
 * 2. gets its direction and size from the region it lands in (tall streaks
 *    in the aurora, long flat strokes on water, short dabs on walls);
 * 3. shrinks where the scene has an edge, so windows and rooftops stay
 *    readable instead of being smeared by big strokes.
 *
 * Old strokes are never cleared. New ones keep covering them, so the
 * painting follows the moving scene with a soft lag, like wet paint.
 *
 * `sizeMul` makes strokes larger during the opening reveal.
 */
export function paintStrokes(input: StrokeInput, count: number, sizeMul: number): void {
  const { ctx, view, layout, band, pixels: data, t } = input;
  const { width: W, height: H, sceneW: SW, sceneH: SH } = view;
  const area = input.area ?? { x: 0, y: 0, width: W, height: H };
  // Device pixels per scene pixel.
  const kx = W / SW;
  const ky = H / SH;
  // Stroke sizes below are in CSS pixels; scale to device pixels. Narrow
  // screens get finer strokes so the small scene still shows detail.
  const base = view.dpr * (view.narrow ? 0.55 : 1);

  for (let i = 0; i < count; i++) {
    const px = area.x + Math.random() * area.width;
    const py = area.y + Math.random() * area.height;
    // Clamp both ways: a small area near an edge can reach just past it.
    const sx = Math.max(0, Math.min(SW - 1, (px / kx) | 0));
    const sy = Math.max(0, Math.min(SH - 1, (py / ky) | 0));

    // The pixel array is RGBA, 4 bytes per pixel, row after row.
    const idx = (sy * SW + sx) * 4;
    let r = data[idx];
    let g = data[idx + 1];
    let b = data[idx + 2];

    // Edge strength: how different this pixel is from its right and lower
    // neighbors, summed over all channels and scaled so ~110 counts as a
    // full edge (e = 1). Flat areas give e ≈ 0.
    const ix = (sy * SW + Math.min(SW - 1, sx + 1)) * 4;
    const iy = (Math.min(SH - 1, sy + 1) * SW + sx) * 4;
    const diff =
      Math.abs(r - data[ix]) +
      Math.abs(g - data[ix + 1]) +
      Math.abs(b - data[ix + 2]) +
      Math.abs(r - data[iy]) +
      Math.abs(g - data[iy + 1]) +
      Math.abs(b - data[iy + 2]);
    const e = Math.min(1, diff / 110);

    // Angles are in radians: 0 is horizontal, π/2 is vertical.
    let angle: number;
    let length: number;
    let width: number;
    switch (regionAt(layout, view, band, sx, sy)) {
      case Region.Water:
        // Nearly flat, with a slow wave so the strokes follow the swell.
        angle = (Math.random() - 0.5) * 0.12 + Math.sin(sy * 0.3 + t * 0.5) * 0.05;
        length = 26 + Math.random() * 30;
        width = 2.5 + Math.random() * 2.5;
        break;
      case Region.Solid:
        // Mostly vertical dabs (like stucco), some horizontal.
        angle =
          Math.random() < 0.7
            ? Math.PI / 2 + (Math.random() - 0.5) * 0.2
            : (Math.random() - 0.5) * 0.2;
        length = 8 + Math.random() * 10;
        width = 3 + Math.random() * 3;
        break;
      case Region.Aurora:
        angle = Math.PI / 2 + (Math.random() - 0.5) * 0.25;
        length = 18 + Math.random() * 26;
        width = 3 + Math.random() * 3;
        break;
      default:
        // Open sky: the angle drifts smoothly across the canvas, so nearby
        // strokes swirl together, like brushwork in a painted sky.
        angle = 0.5 * Math.sin(sx * 0.035 + sy * 0.06 + t * 0.05) + (Math.random() - 0.5) * 0.3;
        length = 16 + Math.random() * 22;
        width = 4 + Math.random() * 4;
    }

    // On a full edge, strokes shrink to 22% of their length.
    const f = (1 - 0.78 * e) * sizeMul;
    length *= f * base;
    width *= Math.max(0.35, f) * base;

    // Color jitter: one shared shift (lighter or darker) plus a small
    // per-channel shift (slightly different hue).
    const shared = (Math.random() - 0.5) * 16;
    r = clamp255(r + shared + (Math.random() - 0.5) * 10);
    g = clamp255(g + shared + (Math.random() - 0.5) * 10);
    b = clamp255(b + shared + (Math.random() - 0.5) * 10);

    // The stroke runs from (x0, y0) to (x1, y1), centered on the landing
    // point. (cos, sin) is the stroke's direction; (−sin, cos) is
    // perpendicular to it. Pushing the curve's control point sideways
    // along that perpendicular by `bend` gives the stroke a slight arc.
    const ca = Math.cos(angle);
    const sa = Math.sin(angle);
    const half = length / 2;
    const x0 = px - ca * half;
    const y0 = py - sa * half;
    const x1 = px + ca * half;
    const y1 = py + sa * half;
    const bend = (Math.random() - 0.5) * length * 0.25;
    const cx = px - sa * bend;
    const cy = py + ca * bend;

    ctx.strokeStyle = `rgba(${r | 0},${g | 0},${b | 0},${(0.72 + Math.random() * 0.25).toFixed(2)})`;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(cx, cy, x1, y1);
    ctx.stroke();

    // Some strokes get a thin highlight on one side (30%) or a shadow on
    // the other (15%), like the ridge of thick paint catching light.
    const roll = Math.random();
    if (roll < 0.45) {
      const highlight = roll < 0.3;
      const o = highlight ? -width * 0.3 : width * 0.35;
      ctx.strokeStyle = highlight ? "rgba(255,255,255,.09)" : "rgba(0,0,0,.12)";
      ctx.lineWidth = width * 0.3;
      ctx.beginPath();
      ctx.moveTo(x0 + o, y0 + o);
      ctx.quadraticCurveTo(cx + o, cy + o, x1 + o, y1 + o);
      ctx.stroke();
    }
  }
}

/**
 * Adjusts how many strokes are painted per frame to the device's speed.
 *
 * At 60 fps a frame has about 16.7 ms. The stroke pass may use up to about
 * 12 ms of it. If it took longer, paint 8% fewer strokes next frame; if it
 * took under 6 ms, paint 4% more. Shrinking faster than growing backs off
 * quickly from stutter and creeps back up carefully.
 */
export class StrokeBudget {
  private value = 1100;
  private max: number;

  constructor(max: number) {
    this.max = max;
    this.value = Math.min(this.value, max);
  }

  get count(): number {
    return Math.round(this.value);
  }

  setMax(max: number): void {
    this.max = max;
    this.value = Math.min(this.value, max);
  }

  record(costMs: number): void {
    if (costMs > 12) this.value = Math.max(300, this.value * 0.92);
    else if (costMs < 6) this.value = Math.min(this.max, this.value * 1.04);
  }
}
