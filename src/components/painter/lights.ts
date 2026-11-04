import { rgba } from "./color";
import { LANTERN_BOB, type Lantern } from "./lanterns";
import type { SceneLayout, Viewport } from "./layout";
import type { Palette, ThemeColors } from "./palettes";
import type { Sprites } from "./sprites";

export interface LightsInput {
  /** Context of the visible lights canvas. */
  ctx: CanvasRenderingContext2D;
  view: Viewport;
  layout: SceneLayout;
  palette: Palette;
  sprites: Sprites;
  theme: ThemeColors;
  lanterns: readonly Lantern[];
  /** Animation time in seconds. */
  t: number;
}

/**
 * The light layer: what paint can't hold. Redrawn from scratch every frame
 * on its own canvas, on top of the strokes.
 *
 * Two kinds of blending make it glow. Inside this canvas, "lighter" adds
 * overlapping glows together. The canvas itself uses CSS
 * `mix-blend-mode: screen`, which can only brighten the painting under it.
 */
export function drawLights(input: LightsInput): void {
  const { ctx: c, view, layout, palette: p, sprites, theme, lanterns, t } = input;
  const { width: W, height: H, sceneW: SW, sceneH: SH, horizon: hy, dpr } = view;
  // Device pixels per scene pixel, to place scene objects on this canvas.
  const kx = W / SW;
  const ky = H / SH;

  c.clearRect(0, 0, W, H);
  c.globalCompositeOperation = "lighter";

  // Stars twinkle: |sin| keeps brightness between 35% and 100%.
  if (p.stars > 0.02) {
    c.fillStyle = rgba(theme.starlight);
    for (const star of layout.stars) {
      c.globalAlpha = p.stars * (0.35 + 0.65 * Math.abs(Math.sin(t * 0.8 + star.seed)));
      const r = star.r * dpr;
      c.fillRect(star.x * W - r / 2, star.y * H - r / 2, r, r);
    }
  }

  if (p.windowLight > 0.02) {
    for (const w of layout.windows) {
      if (!w.lit) continue;
      const flicker = 0.8 + 0.2 * Math.sin(t * 3 + w.seed);
      const R = w.w * kx * 2.4;
      c.globalAlpha = 0.38 * p.windowLight * flicker;
      c.drawImage(sprites.glowWarm, w.cx * kx - R, (w.y + w.h * 0.5) * ky - R, R * 2, R * 2);
    }
    for (const light of layout.distantLights) {
      c.globalAlpha = p.windowLight * (0.4 + 0.4 * Math.sin(t * 1.7 + light.seed));
      const R = 5 * dpr;
      c.drawImage(sprites.glowWarm, light.x * kx - R, light.y * ky - R, R * 2, R * 2);
    }
  }

  // Lamps and lanterns stay at least a little lit, even in daylight.
  const lampAmount = Math.max(p.windowLight, 0.25);

  // Gondola lamp: a round glow plus a tall, narrow one below it for the
  // reflection on the water.
  const G = layout.gondola;
  const gR = G.length * kx * 0.22;
  const gFlicker = 0.85 + 0.15 * Math.sin(t * 4.1);
  c.globalAlpha = 0.75 * lampAmount * gFlicker;
  c.drawImage(sprites.glowWarm, G.lampX * kx - gR, G.lampY * ky - gR, gR * 2, gR * 2);
  c.globalAlpha = 0.35 * lampAmount * gFlicker;
  c.drawImage(
    sprites.glowWarm,
    G.lampX * kx - gR * 0.5,
    (G.lampY + G.length * 0.3) * ky - gR * 1.4,
    gR,
    gR * 2.8,
  );

  for (const lantern of lanterns) {
    const R = Math.max(14 * dpr, SW * 0.03 * kx);
    const flicker = 0.8 + 0.2 * Math.sin(t * 3.3 + lantern.seed);
    const y = lantern.y + Math.sin(t * 1.1 + lantern.seed) * LANTERN_BOB;
    c.globalAlpha = 0.7 * lampAmount * flicker;
    c.drawImage(sprites.glowWarm, lantern.x * kx - R, (y - 1) * ky - R, R * 2, R * 2);
    c.globalAlpha = 0.3 * lampAmount * flicker;
    c.drawImage(sprites.glowWarm, lantern.x * kx - R * 0.4, (y + 4) * ky - R, R * 0.8, R * 2.4);
  }

  // Sun glints: sparkles in a column under the sun, the "path" of sunlight
  // on water. `d` is depth below the horizon; the column widens toward the
  // viewer. The values look random but come from hash01, so the same time
  // step always gives the same glints. While animating, the step changes
  // 30 times a second and they sparkle. While paused, t is frozen, so
  // redrawing this layer (to add a lantern) leaves the glints unchanged.
  if (p.sun > 0.05) {
    const cx = p.sunX * W;
    const step = Math.floor(t * 30);
    for (let i = 0; i < 34; i++) {
      const d = hash01(i * 4, step);
      const y = hy * ky + d * (H - hy * ky);
      const x = cx + (hash01(i * 4 + 1, step) - 0.5) * W * 0.1 * (1 + d * 2.5);
      const R = (2 + hash01(i * 4 + 2, step) * 4) * dpr;
      c.globalAlpha = p.sun * 0.55 * hash01(i * 4 + 3, step);
      c.drawImage(sprites.glowWhite, x - R, y - R, R * 2, R * 2);
    }
  }

  c.globalAlpha = 1;
  c.globalCompositeOperation = "source-over";
}

/**
 * A repeatable pseudo-random number in [0, 1): the same (a, b) always gives
 * the same result. Math.imul multiplies as 32-bit integers, and the shifts
 * and XORs mix the bits so that nearby inputs give unrelated outputs. `>>> 0`
 * reads the result as unsigned, and dividing by 2^32 maps it to [0, 1).
 */
function hash01(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be59b, 0xc2b2ae35);
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
