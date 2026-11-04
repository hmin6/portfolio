import { mix, rgba } from "./color";
import { LANTERN_BOB, lanternSize, type Lantern } from "./lanterns";
import type { AuroraBand, SceneLayout, Viewport } from "./layout";
import { WARM_GLOW, type Palette, type ThemeColors } from "./palettes";
import type { Sprites } from "./sprites";

/**
 * Everything drawScene needs for one frame. `band` and `layout.gondola`'s
 * lamp position are written to; the rest is read.
 */
export interface SceneInput {
  /** Context of the hidden, low-resolution scene canvas. */
  ctx: CanvasRenderingContext2D;
  view: Viewport;
  layout: SceneLayout;
  palette: Palette;
  sprites: Sprites;
  theme: ThemeColors;
  lanterns: readonly Lantern[];
  /** Animation time in seconds. */
  t: number;
  band: AuroraBand;
}

/**
 * Draws the plain, hidden version of the view. Visitors never see this
 * canvas; brushstrokes sample its colors (see strokes.ts).
 * Order matters: later layers cover earlier ones.
 */
export function drawScene(input: SceneInput): void {
  const { ctx: s } = input;
  s.globalAlpha = 1;
  s.globalCompositeOperation = "source-over";
  drawSky(input);
  drawAurora(input);
  drawSkyline(input);
  drawWater(input);
  drawBridge(input);
  drawBuildings(input);
  drawBuildingReflections(input);
  drawPoles(input);
  drawGondola(input);
  drawLanterns(input);
}

function drawSky({ ctx: s, view, palette: p, sprites }: SceneInput): void {
  const { sceneW: SW, sceneH: SH, horizon: hy } = view;
  const g = s.createLinearGradient(0, 0, 0, hy);
  g.addColorStop(0, rgba(p.skyTop));
  g.addColorStop(1, rgba(p.skyHorizon));
  s.fillStyle = g;
  s.fillRect(0, 0, SW, hy + 1);

  if (p.sun > 0.01) {
    const sx = SW * p.sunX;
    const sy = SH * p.sunY;
    const R = SW * 0.28;
    s.globalAlpha = p.sun * 0.7;
    s.drawImage(sprites.glowWarm, sx - R, sy - R, R * 2, R * 2);
    s.globalAlpha = p.sun;
    s.fillStyle = rgba(p.sunColor);
    s.beginPath();
    s.arc(sx, sy, SW * 0.022, 0, Math.PI * 2);
    s.fill();
    s.globalAlpha = 1;
  }
}

/** How strong each of the three curtains is, back to front. */
const CURTAIN_STRENGTH = [0.9, 0.7, 0.6];

/**
 * Three aurora curtains, drawn one scene column at a time. For each curtain
 * in each column x (0 to 1 across the scene):
 *
 * - `yb`, its lower edge, is a sum of two sine waves with different
 *   frequencies and speeds. Neither repeats in step with the other, so the
 *   edge ripples like fabric instead of sliding sideways as one wave.
 * - `h`, its height, breathes slowly with a third sine wave.
 * - `intensity` is another sum of sines, clipped at 0, which gives the
 *   curtain bright folds and dark gaps.
 *
 * The `k` terms shift each curtain's phase so the three don't move together.
 * "lighter" compositing adds colors, so overlapping curtains glow brighter,
 * like real aurora. Each column's extent is saved in `band` so strokes there
 * can be painted as vertical streaks.
 */
function drawAurora({ ctx: s, view, palette: p, sprites, t, band }: SceneInput): void {
  const { sceneW: SW, sceneH: SH, horizon: hy } = view;
  band.length = SW;
  if (p.aurora <= 0.01) {
    band.fill(null);
    return;
  }
  s.globalCompositeOperation = "lighter";
  for (let i = 0; i < SW; i++) {
    const x = i / SW;
    let top = SH;
    let bottom = 0;
    let strength = 0;
    for (let k = 0; k < 3; k++) {
      const yb =
        hy -
        SH * (0.1 + k * 0.075) +
        SH * 0.06 * Math.sin(x * 5.1 + t * 0.22 + k) +
        SH * 0.025 * Math.sin(x * 13.7 - t * 0.34 + k * 2.1);
      const h = SH * (0.16 + 0.07 * Math.sin(x * 3.3 + t * 0.14 + k * 1.7));
      const intensity =
        Math.max(
          0,
          0.5 +
            0.5 * Math.sin(x * 8.3 + t * 0.26 + k * 2.9) +
            0.25 * Math.sin(x * 21 - t * 0.6 + k),
        ) *
        p.aurora *
        CURTAIN_STRENGTH[k];
      if (intensity <= 0.02) continue;
      s.globalAlpha = Math.min(1, intensity);
      // 1.5 wide instead of 1 so neighboring columns overlap with no gaps.
      s.drawImage(sprites.auroraStrips[k], i, yb - h, 1.5, h);
      top = Math.min(top, yb - h);
      bottom = Math.max(bottom, yb);
      strength = Math.max(strength, intensity);
    }
    band[i] = { top, bottom, strength };
  }
  s.globalCompositeOperation = "source-over";
  s.globalAlpha = 1;
}

/**
 * Far skyline blocks: [left, right, height] as fractions of the scene.
 * Heights are measured up from the horizon.
 */
const SKYLINE_BLOCKS: readonly (readonly [number, number, number])[] = [
  [0.22, 0.8, 0.012],
  [0.26, 0.3, 0.03],
  [0.31, 0.335, 0.04],
  [0.42, 0.47, 0.035],
  [0.475, 0.5, 0.026],
  [0.7, 0.74, 0.032],
  [0.745, 0.8, 0.022],
  [0.34, 0.39, 0.045],
  [0.58, 0.68, 0.048],
];

/** Small domes: [center x, x radius, y radius] as fractions of the scene. */
const SKYLINE_DOMES: readonly (readonly [number, number, number])[] = [
  [0.597, 0.012, 0.022],
  [0.63, 0.015, 0.03],
  [0.663, 0.012, 0.022],
];

function drawSkyline({ ctx: s, view, palette: p }: SceneInput): void {
  const { sceneW: SW, sceneH: SH, horizon: hy } = view;
  s.fillStyle = rgba(p.distant);
  for (const [a, b, h] of SKYLINE_BLOCKS) {
    s.fillRect(SW * a, hy - SH * h, SW * (b - a), SH * h + 1);
  }
  // Large dome with a small lantern on top.
  s.beginPath();
  s.ellipse(SW * 0.365, hy - SH * 0.045, SW * 0.025, SH * 0.035, 0, Math.PI, 0);
  s.fill();
  s.fillRect(SW * 0.362, hy - SH * 0.1, SW * 0.006, SH * 0.02);
  // Bell tower with a pointed roof.
  s.fillRect(SW * 0.545, hy - SH * 0.17, SW * 0.016, SH * 0.17);
  s.beginPath();
  s.moveTo(SW * 0.542, hy - SH * 0.17);
  s.lineTo(SW * 0.564, hy - SH * 0.17);
  s.lineTo(SW * 0.553, hy - SH * 0.22);
  s.closePath();
  s.fill();
  for (const [cx, rx, ry] of SKYLINE_DOMES) {
    s.beginPath();
    s.ellipse(SW * cx, hy - SH * 0.048, SW * rx, SH * ry, 0, Math.PI, 0);
    s.fill();
  }
}

/**
 * The water is the sky mirrored at the horizon: row y copies row
 * (2 × horizon − y − 1), the row the same distance above the horizon.
 * Each copied row is shifted sideways by a small sine offset. `d` is depth
 * (0 at the horizon, 1 at the bottom), and the offset grows with it, so
 * ripples are larger closer to the viewer, as with real perspective.
 * This copies from the scene canvas onto itself, which Canvas 2D allows.
 */
function drawWater({ ctx: s, view, palette: p, t }: SceneInput): void {
  const { sceneW: SW, sceneH: SH, horizon: hy } = view;
  for (let y = hy; y < SH; y++) {
    const d = (y - hy) / (SH - hy);
    const src = Math.max(0, 2 * hy - y - 1);
    const offset =
      Math.sin(y * 0.8 + t * 1.6) * (0.6 + d * 2.5) + Math.sin(y * 0.23 - t * 0.9) * d * 2;
    s.drawImage(s.canvas, 0, src, SW, 1, offset, y, SW, 1);
  }
  // Tint deepens toward the viewer, like looking down into the water.
  const g = s.createLinearGradient(0, hy, 0, SH);
  g.addColorStop(0, rgba(p.waterTint, 0.25));
  g.addColorStop(1, rgba(p.waterTint, 0.88));
  s.fillStyle = g;
  s.fillRect(0, hy, SW, SH - hy);
}

function drawBridge({ ctx: s, view, layout, palette: p }: SceneInput): void {
  const { sceneW: SW, sceneH: SH } = view;
  const { x0, x1, y } = layout.bridge;
  const mid = (x0 + x1) / 2;
  // An arch: outer curve over the top, inner curve back underneath.
  s.fillStyle = rgba(p.wall);
  s.beginPath();
  s.moveTo(x0, y);
  s.lineTo(x0, y - SH * 0.02);
  s.quadraticCurveTo(mid, y - SH * 0.07, x1, y - SH * 0.02);
  s.lineTo(x1, y);
  s.lineTo(x1 - SW * 0.012, y);
  s.quadraticCurveTo(mid, y - SH * 0.045, x0 + SW * 0.012, y);
  s.closePath();
  s.fill();
  // Reflection: flip the same path upside down around the waterline.
  // translate(0, 2y) then scale(1, −1) maps a point at height y − a to y + a.
  s.globalAlpha = 0.35;
  s.save();
  s.translate(0, 2 * y);
  s.scale(1, -1);
  s.fill();
  s.restore();
  s.globalAlpha = 1;
}

function drawBuildings({ ctx: s, view, layout, palette: p, theme, t }: SceneInput): void {
  const { sceneW: SW, sceneH: SH } = view;
  for (const b of layout.buildings) {
    const color = p[b.wall];
    const bw = b.x1 - b.x0;
    const bh = b.base - b.top;
    s.fillStyle = rgba(color);
    s.fillRect(b.x0, b.top, bw, bh);
    s.fillRect(b.x0 + bw * 0.2, b.top - SH * 0.02, bw * 0.6, SH * 0.02);

    // Darken both sides so the wall looks rounded rather than flat.
    const shade = s.createLinearGradient(b.x0, 0, b.x1, 0);
    shade.addColorStop(0, "rgba(0,0,0,.18)");
    shade.addColorStop(0.5, "rgba(0,0,0,0)");
    shade.addColorStop(1, "rgba(0,0,0,.18)");
    s.fillStyle = shade;
    s.fillRect(b.x0, b.top, bw, bh);

    // Chimneys with flared caps.
    s.fillStyle = rgba(color);
    for (const f of b.chimneys) {
      const cx = b.x0 + bw * f;
      const cw = SW * 0.009;
      s.fillRect(cx - cw / 2, b.top - SH * 0.06, cw, SH * 0.05);
      s.beginPath();
      s.moveTo(cx - cw * 1.4, b.top - SH * 0.075);
      s.lineTo(cx + cw * 1.4, b.top - SH * 0.075);
      s.lineTo(cx + cw * 0.6, b.top - SH * 0.055);
      s.lineTo(cx - cw * 0.6, b.top - SH * 0.055);
      s.closePath();
      s.fill();
    }

    if (p.rimLight > 0.01) {
      // Aurora light from above: the upper wall is lit and the lower wall
      // falls into shadow. The sky is darkest high up and brightest near
      // the horizon, so this keeps the wall a different value from the sky
      // beside it along its whole height, instead of matching it halfway.
      const fall = s.createLinearGradient(0, b.top, 0, b.base);
      fall.addColorStop(0, rgba(theme.teal, 0.24 * p.rimLight));
      fall.addColorStop(0.45, rgba(theme.teal, 0));
      fall.addColorStop(0.55, "rgba(0,0,0,0)");
      fall.addColorStop(1, `rgba(0,0,0,${0.5 * p.rimLight})`);
      s.fillStyle = fall;
      s.fillRect(b.x0, b.top, bw, bh);

      // Aurora light catching the roofline (and the raised roof cap) and
      // the edge that faces the canal.
      s.fillStyle = rgba(theme.aurora, p.rimLight);
      s.fillRect(b.x0, b.top, bw, 1);
      s.fillRect(b.x0 + bw * 0.2, b.top - SH * 0.02, bw * 0.6, 1);
      const edge = b.x0 === 0 ? b.x1 - 1.5 : b.x0;
      s.fillRect(edge, b.top, 1.5, bh);
    }

    // Balcony ledge.
    s.fillStyle = rgba(mix(color, [0, 0, 0], 0.25));
    s.fillRect(b.x0 + bw * 0.25, b.top + bh * 0.33, bw * 0.5, SH * 0.006);
  }

  // Arched windows. Lit ones flicker: two sines multiplied give an uneven
  // flicker that doesn't look like a steady pulse.
  for (const w of layout.windows) {
    const flicker = 0.85 + 0.15 * Math.sin(t * 3 + w.seed) * Math.sin(t * 1.3 + w.seed * 2);
    const color = w.lit
      ? mix(p.windowDark, p.windowLit, p.windowLight * flicker)
      : p.windowDark;
    s.fillStyle = rgba(color);
    s.beginPath();
    s.moveTo(w.cx - w.w / 2, w.y + w.h);
    s.lineTo(w.cx - w.w / 2, w.y + w.w / 2);
    s.arc(w.cx, w.y + w.w / 2, w.w / 2, Math.PI, 0);
    s.lineTo(w.cx + w.w / 2, w.y + w.h);
    s.closePath();
    s.fill();
  }

  // Arched water door on the left building.
  const lb = layout.buildings[0];
  const lbw = lb.x1 - lb.x0;
  const dw = lbw * 0.22;
  const dx = lb.x0 + lbw * 0.39;
  s.fillStyle = rgba(mix(p.wall, [0, 0, 0], 0.5));
  s.beginPath();
  s.moveTo(dx, lb.base);
  s.lineTo(dx, lb.base - SH * 0.05);
  s.arc(dx + dw / 2, lb.base - SH * 0.05, dw / 2, Math.PI, 0);
  s.lineTo(dx + dw, lb.base);
  s.closePath();
  s.fill();
}

/**
 * Buildings reflected in the canal, the same row-by-row mirror as the sky
 * (see drawWater) but flipped at each building's waterline. Lit windows add
 * broken streaks of light on the water below them.
 */
function drawBuildingReflections({ ctx: s, view, layout, palette: p, t }: SceneInput): void {
  const { sceneH: SH } = view;
  for (const b of layout.buildings) {
    const bw = b.x1 - b.x0;
    const end = Math.min(SH, b.base + (b.base - b.top));
    s.globalAlpha = 0.55;
    for (let y = Math.ceil(b.base); y < end; y++) {
      const src = Math.max(0, Math.floor(2 * b.base - y - 1));
      const offset = Math.sin(y * 0.9 + t * 1.7) * (1 + (y - b.base) * 0.03);
      s.drawImage(s.canvas, b.x0, src, bw, 1, b.x0 + offset, y, bw, 1);
    }
    s.globalAlpha = 1;
    const g = s.createLinearGradient(0, b.base, 0, end);
    g.addColorStop(0, rgba(p.waterTint, 0.3));
    g.addColorStop(1, rgba(p.waterTint, 0.8));
    s.fillStyle = g;
    s.fillRect(b.x0 - 3, b.base, bw + 6, end - b.base);
  }

  if (p.windowLight <= 0.02) return;
  s.fillStyle = rgba(p.windowLit);
  for (const w of layout.windows) {
    if (!w.lit) continue;
    const b = layout.buildings[w.building];
    const flicker = 0.85 + 0.15 * Math.sin(t * 3 + w.seed);
    // Ten short dashes going down, each narrower or wider over time and
    // fading with distance, like light broken up by ripples.
    for (let j = 0; j < 10; j++) {
      const yy = b.base + 2 + j * 2.2 + (b.base - (w.y + w.h)) * 0.6;
      if (yy > SH) break;
      const ww = w.w * (0.5 + 0.45 * Math.sin(j * 1.7 + t * 2 + w.seed));
      s.globalAlpha = p.windowLight * flicker * 0.55 * (1 - j / 10);
      s.fillRect(w.cx - ww / 2 + Math.sin(j + t * 1.4) * 1.2, yy, ww, 1.2);
    }
  }
  s.globalAlpha = 1;
}

/** Striped mooring poles with wavering reflections. */
function drawPoles({ ctx: s, view, layout, palette: p, t }: SceneInput): void {
  const { sceneW: SW, sceneH: SH } = view;
  const pw = Math.max(2, SW * 0.008);
  for (const pole of layout.poles) {
    s.fillStyle = rgba(p.pole);
    s.fillRect(pole.x, pole.top, pw, pole.bottom - pole.top);
    s.fillStyle = rgba(p.stripe);
    for (let k = 0; k < 3; k++) {
      s.fillRect(pole.x, pole.top + k * SH * 0.022, pw, SH * 0.008);
    }
    s.globalAlpha = 0.35;
    s.fillStyle = rgba(p.pole);
    s.fillRect(pole.x + Math.sin(t * 1.5 + pole.x), pole.bottom, pw, SH * 0.06);
    s.globalAlpha = 1;
  }
}

/**
 * The gondola, drawn around its own center with every size a fraction of
 * its length L, so it scales with the scene. It bobs up and down and rocks
 * slightly, with two slow sines at different speeds.
 */
function drawGondola({ ctx: s, view, layout, palette: p, theme, t }: SceneInput): void {
  const { sceneH: SH } = view;
  const G = layout.gondola;
  const L = G.length;
  const bob = Math.sin(t * 0.9) * SH * 0.004;

  // At night the near-black boat sits on near-black water. A soft band of
  // reflected aurora light on the water behind it gives the hull something
  // to stand out against, the way a silhouette reads against a lit surface.
  if (p.rimLight > 0.01) {
    s.globalAlpha = 0.9 * p.rimLight;
    s.fillStyle = rgba(theme.teal);
    s.beginPath();
    s.ellipse(G.x, G.y + bob - L * 0.02, L * 0.62, L * 0.09, 0, 0, Math.PI * 2);
    s.fill();
    s.globalAlpha = 1;
  }

  s.save();
  s.translate(G.x, G.y + bob);
  s.rotate(Math.sin(t * 0.7) * 0.012);
  s.fillStyle = rgba(p.boat);
  s.strokeStyle = rgba(p.boat);

  // Hull: a crescent between two curves, higher at the bow (right).
  s.beginPath();
  s.moveTo(-L / 2, -L * 0.02);
  s.quadraticCurveTo(0, L * 0.09, L / 2, -L * 0.03);
  s.lineTo(L / 2 + L * 0.02, -L * 0.08);
  s.quadraticCurveTo(0, L * 0.035, -L / 2 + L * 0.01, -L * 0.05);
  s.closePath();
  s.fill();

  // Gunwale highlight picks up a little sky color, and aurora green at night.
  s.strokeStyle = rgba(mix(mix(p.boat, p.skyHorizon, 0.65), theme.aurora, p.rimLight * 0.8));
  s.lineWidth = Math.max(1, L * 0.012);
  s.beginPath();
  s.moveTo(-L / 2 + L * 0.01, -L * 0.05);
  s.quadraticCurveTo(0, L * 0.035, L / 2 + L * 0.02, -L * 0.08);
  s.stroke();
  s.strokeStyle = rgba(p.boat);

  // Bow iron (the comb-shaped ornament at the front).
  s.fillRect(L / 2 + L * 0.008, -L * 0.15, L * 0.014, L * 0.08);
  for (let k = 0; k < 3; k++) {
    s.fillRect(L / 2 + L * 0.02, -L * (0.14 - k * 0.022), L * 0.03, L * 0.008);
  }

  // Curled stern.
  s.beginPath();
  s.moveTo(-L / 2, -L * 0.02);
  s.quadraticCurveTo(-L / 2 - L * 0.04, -L * 0.07, -L / 2 - L * 0.005, -L * 0.12);
  s.lineTo(-L / 2 + L * 0.01, -L * 0.11);
  s.quadraticCurveTo(-L / 2 - L * 0.02, -L * 0.06, -L / 2 + L * 0.02, -L * 0.04);
  s.closePath();
  s.fill();

  // Gondolier: body, head, and oar.
  s.fillRect(-L * 0.38, -L * 0.21, L * 0.045, L * 0.17);
  s.beginPath();
  s.arc(-L * 0.358, -L * 0.235, L * 0.024, 0, Math.PI * 2);
  s.fill();
  s.lineWidth = Math.max(1, L * 0.012);
  s.beginPath();
  s.moveTo(-L * 0.34, -L * 0.17);
  s.lineTo(-L * 0.22, L * 0.07);
  s.stroke();

  // Lamp post near the bow.
  s.fillRect(L * 0.41, -L * 0.14, L * 0.009, L * 0.1);
  s.fillStyle = rgba(mix(p.windowDark, WARM_GLOW, Math.max(p.windowLight, 0.3)));
  s.fillRect(L * 0.4, -L * 0.165, L * 0.03, L * 0.03);
  s.restore();

  // Lamp position in scene pixels, for the glow in lights.ts.
  G.lampX = G.x + L * 0.415;
  G.lampY = G.y + bob - L * 0.15;

  // Shadow on the water.
  s.globalAlpha = 0.3;
  s.fillStyle = rgba(p.boat);
  s.beginPath();
  s.ellipse(G.x, G.y + bob + L * 0.06, L * 0.48, L * 0.025, 0, 0, Math.PI * 2);
  s.fill();
  s.globalAlpha = 1;
}

function drawLanterns({ ctx: s, view, palette: p, lanterns, t }: SceneInput): void {
  const size = lanternSize(view);
  for (const lantern of lanterns) {
    const y = lantern.y + Math.sin(t * 1.1 + lantern.seed) * LANTERN_BOB;
    s.fillStyle = rgba(mix(WARM_GLOW, p.windowLit, 0.4));
    s.fillRect(lantern.x - size / 2, y - size, size, size);
    // Wobbly reflection streaks below the lantern.
    s.globalAlpha = 0.45;
    for (let j = 0; j < 5; j++) {
      s.fillRect(
        lantern.x - size * 0.4 + Math.sin(j * 1.9 + t * 2),
        y + 2 + j * 2,
        size * 0.8,
        1,
      );
    }
    s.globalAlpha = 1;
  }
}
