import { between, r1, seeded } from "./random";

/*
 * Aurora's painting for The Collection: aurora curtains over a dark shoreline,
 * reflected in still water. It's a different scene from the hero's canal,
 * painted in the same spirit: a flat underpaint, then layers of short,
 * semi-transparent brushstrokes, each slightly curved, with round ends.
 *
 * It's an SVG made on the server (ADR-010): it arrives as HTML, needs no
 * JavaScript, stays sharp at any size, and never moves, so there's nothing
 * for reduced motion to stop. The strokes are placed by a seeded generator,
 * so every build paints exactly the same picture.
 *
 * Colors are the Night tokens as CSS variables, so the painting follows the
 * palette in globals.css.
 */

const W = 400;
const H = 300;
/** Where the far shore meets the water. */
const HORIZON = 200;

/**
 * The painting's layers, painted in this order. The reflection is its own
 * layer so it can be softened with a blur, and the water's ripples come
 * after it so they break it up.
 */
type Layer = "sky" | "curtain" | "reflection" | "water";

/**
 * One <path> of the painting: every stroke in a layer that shares a color,
 * width, and opacity. See `paint` for why strokes are grouped.
 */
interface StrokeGroup {
  d: string;
  color: string;
  width: number;
  opacity: number;
}

/**
 * A gently curved stroke from (x1, y1) to (x2, y2), bowed through (cx, cy).
 * Whole units: at this size a fraction of a unit isn't visible, and every
 * digit is sent to the browser twice (see `paint`).
 */
function curve(x1: number, y1: number, cx: number, cy: number, x2: number, y2: number): string {
  const n = Math.round;
  return `M${n(x1)} ${n(y1)}Q${n(cx)} ${n(cy)} ${n(x2)} ${n(y2)}`;
}

/**
 * The aurora's lower edge at x: two slow waves added together, so the
 * curtain folds like a hanging cloth instead of following a regular sine.
 */
function curtainBase(x: number): number {
  const t = x / W;
  return 134 + 16 * Math.sin(t * Math.PI * 2.2 + 0.4) + 6 * Math.sin(t * Math.PI * 6.3 + 1.1);
}

/**
 * How tall the rays are at x: two peaks of different heights and widths,
 * plus a quicker ripple, so the curtain's top rises and falls instead of
 * running level.
 */
function curtainHeight(x: number): number {
  return (
    32 +
    60 * Math.exp(-(((x - 150) / 80) ** 2)) +
    34 * Math.exp(-(((x - 322) / 50) ** 2)) +
    8 * Math.sin((x / W) * Math.PI * 7 + 1)
  );
}

/**
 * Where the curtain folds. Between folds it leans one way, then the other,
 * like a ribbon of cloth turning (see curtainLean). At a fold the curtain is
 * seen edge-on, so the rays bunch together and look brighter.
 */
const FIRST_FOLD = 70;
const FOLD_SPACING = 115;
const FOLDS = [FIRST_FOLD, FIRST_FOLD + FOLD_SPACING, FIRST_FOLD + 2 * FOLD_SPACING];

/** The rays' lean at x: zero at each fold, swinging the other way after it. */
function curtainLean(x: number): number {
  return 7 * Math.sin((Math.PI * (x - FIRST_FOLD)) / FOLD_SPACING);
}

/** How close x is to a fold: 1 on a fold, falling to 0 about 25 units away. */
function foldness(x: number): number {
  return Math.max(...FOLDS.map((f) => Math.exp(-(((x - f) / 12) ** 2))));
}

/**
 * Where a point of the sky appears in the water. A reflection is the sky
 * flipped at the waterline, squashed to under half its height, as it is
 * when the sky is seen low over water from the shore.
 */
const REFLECT = 0.45;
const reflectY = (y: number) => HORIZON + (HORIZON - y) * REFLECT;

/**
 * Paints the picture as groups of strokes.
 *
 * Strokes that share a layer, color, width, and opacity are merged into one
 * <path> (each stroke is its own "M…" piece of it). A Server Component's
 * output is sent twice: once as HTML and once in the React Server Components
 * payload React reads when it takes over the page. An early version, with
 * every stroke its own path and attributes, was 557 paths and 63 KB.
 *
 * The trade-off: strokes inside one path don't build up where they cross
 * the way separate translucent strokes do. Widths and opacities are rounded
 * to a few steps so groups are large, and layering still happens between
 * groups and between layers, which are painted in order.
 */
function paint(): Record<Layer, StrokeGroup[]> {
  const rand = seeded(2026);
  const groups: Record<Layer, Map<string, StrokeGroup>> = {
    sky: new Map(),
    curtain: new Map(),
    reflection: new Map(),
    water: new Map(),
  };
  const add = (layer: Layer, d: string, color: string, width: number, opacity: number) => {
    const w = Math.max(1, Math.round(width));
    const o = Math.min(1, Math.max(0.1, Math.round(opacity * 10) / 10));
    const key = `${color}|${w}|${o}`;
    const group = groups[layer].get(key);
    if (group) group.d += d;
    else groups[layer].set(key, { d, color, width: w, opacity: o });
  };

  // 1. Sky texture: wide, nearly horizontal dabs over the gradient, darker
  //    at the top and lifting toward the horizon.
  for (let i = 0; i < 70; i++) {
    const x = between(rand, -20, W);
    const y = between(rand, 0, HORIZON - 6);
    const len = between(rand, 18, 42);
    const tilt = between(rand, -3, 3);
    const color = y < 90 ? "var(--color-night)" : "var(--color-panel)";
    add("sky", curve(x, y, x + len / 2, y + tilt - 1.5, x + len, y + tilt), color, between(rand, 5, 10), between(rand, 0.35, 0.6));
  }

  // 2. Stars: dots, which a zero-length stroke with round ends draws.
  for (let i = 0; i < 46; i++) {
    const x = between(rand, 0, W);
    const y = between(rand, 2, 150);
    add("sky", `M${r1(x)} ${r1(y)}h0`, "var(--color-starlight)", between(rand, 1, 2.4), between(rand, 0.35, 0.9));
  }

  // 3. The curtains. Each ray is a thin stroke rising from the curtain's
  //    lower edge: green at the bottom, teal higher up, and a faint violet
  //    fringe at the top, like the real thing (oxygen glows green lower in
  //    the sky; nitrogen adds violet at the top). Rays bunch and brighten at
  //    the folds. Most rays also leave a reflection in the water: the same
  //    colors, flipped and squashed, fainter, and wider (they're blurred).
  const ray = (x: number, y: number, h: number, lean: number, width: number, strength: number, reflect: boolean) => {
    const bend = between(rand, -1.5, 1.5);
    const green = between(rand, 0.15, 0.35) * strength;
    const teal = between(rand, 0.1, 0.25) * strength;
    add("curtain", curve(x, y, x + lean * 0.3 + bend, y - h * 0.3, x + lean * 0.55, y - h * 0.55), "var(--color-aurora)", width, green);
    add(
      "curtain",
      curve(x + lean * 0.45, y - h * 0.45, x + lean * 0.7 + bend, y - h * 0.7, x + lean * 0.9, y - h * 0.9),
      "var(--color-teal)",
      width,
      teal,
    );
    add("curtain", curve(x + lean * 0.85, y - h * 0.85, x + lean * 0.95, y - h * 0.95, x + lean * 1.05, y - h * 1.08), "var(--color-violet)", width, between(rand, 0.1, 0.2) * strength);
    if (!reflect) return;
    // Reflections hang straight down: ripples blur away the lean.
    const rx = x + lean * 0.2;
    add("reflection", curve(rx, reflectY(y), rx, reflectY(y - h * 0.3), rx, reflectY(y - h * 0.55)), "var(--color-aurora)", width * 1.4, green * 0.55);
    add("reflection", curve(rx, reflectY(y - h * 0.5), rx, reflectY(y - h * 0.7), rx, reflectY(y - h * 0.9)), "var(--color-teal)", width * 1.4, teal * 0.45);
  };

  // A smaller, fainter curtain farther away, higher and to the right, for
  // depth. Too faint to show in the water.
  for (let i = 0; i < 50; i++) {
    const x = between(rand, 220, W + 6);
    ray(x, 104 + 6 * Math.sin(x / 30) + between(rand, -2, 3), 34 * between(rand, 0.7, 1), between(rand, -2, 2), between(rand, 1.5, 3), 0.7, false);
  }
  // The main curtain: about a third of its rays sit near a fold.
  for (let i = 0; i < 210; i++) {
    const nearFold = rand() < 0.35;
    const x = nearFold
      ? FOLDS[Math.floor(rand() * FOLDS.length)] + (between(rand, -1, 1) + between(rand, -1, 1)) * 10
      : between(rand, -6, W + 6);
    const fold = foldness(x);
    const h = curtainHeight(x) * between(rand, 0.7, 1) * (1 + 0.12 * fold);
    const lean = curtainLean(x) + between(rand, -1, 1);
    ray(x, curtainBase(x) + between(rand, -2, 4), h, lean, between(rand, 1.5, 3.5), 1 + 0.6 * fold, rand() < 0.65);
  }

  // 4. The curtain's bright lower hem: many short, faint strokes just above
  //    its edge, so it glows instead of reading as a hard line.
  for (let i = 0; i < 70; i++) {
    const x = between(rand, -6, W);
    const len = between(rand, 4, 10);
    const lift = between(rand, 0, 5);
    const y1 = curtainBase(x) - lift;
    const y2 = curtainBase(x + len) - lift;
    add("curtain", curve(x, y1, x + len / 2, (y1 + y2) / 2, x + len, y2), "var(--color-aurora)", between(rand, 1, 2), between(rand, 0.2, 0.45));
  }

  // 5. Water: glints of aurora light on the ripples, then dark ripple lines
  //    over the reflection, which break its streaks into pieces. Both are
  //    densest just below the shore, where the reflection is.
  for (let i = 0; i < 46; i++) {
    const x = between(rand, -10, W);
    const y = HORIZON + 4 + (H - HORIZON - 10) * rand() ** 1.6;
    const depth = (y - HORIZON) / (H - HORIZON);
    const len = between(rand, 8, 24);
    const color = rand() < 0.65 ? "var(--color-aurora)" : "var(--color-teal)";
    add("water", curve(x, y, x + len / 2, y + 0.6, x + len, y), color, between(rand, 1, 2.5), between(rand, 0.15, 0.4) * (1 - depth * 0.7));
  }
  for (let i = 0; i < 80; i++) {
    const x = between(rand, -20, W);
    const y = HORIZON + 3 + (H - HORIZON) * rand() ** 1.4;
    const len = between(rand, 20, 60);
    add("water", curve(x, y, x + len / 2, y - 0.8, x + len, y), "var(--color-deep)", between(rand, 1.5, 3.5), between(rand, 0.4, 0.75));
  }

  return {
    sky: [...groups.sky.values()],
    curtain: [...groups.curtain.values()],
    reflection: [...groups.reflection.values()],
    water: [...groups.water.values()],
  };
}

/** Painted once, when this module first loads on the server. */
const LAYERS = paint();

/** The far shore, and a headland rising out of the water at the lower left. */
const FAR_SHORE = `M0 ${HORIZON - 9}C60 ${HORIZON - 14} 110 ${HORIZON - 4} 170 ${HORIZON - 6}S290 ${HORIZON - 3} ${W} ${HORIZON - 7}V${HORIZON + 1}H0Z`;
const HEADLAND = `M0 236C40 236 80 244 112 262S150 292 162 ${H}H0Z`;

/** One layer's stroke groups, each a <path>. A group's color, width, and opacity are unique within its layer, so they make the key. */
function Strokes({ groups }: { groups: StrokeGroup[] }) {
  return groups.map((s) => (
    <path key={`${s.color}|${s.width}|${s.opacity}`} d={s.d} stroke={s.color} strokeWidth={s.width} opacity={s.opacity} />
  ));
}

export default function AuroraPainting({ alt }: { alt: string }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={alt} className="block h-auto w-full">
      <defs>
        <linearGradient id="aurora-painting-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--color-deep)" />
          <stop offset="0.55" stopColor="var(--color-night)" />
          <stop offset="1" stopColor="var(--color-panel)" />
        </linearGradient>
        <linearGradient id="aurora-painting-water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--color-panel)" />
          <stop offset="1" stopColor="var(--color-deep)" />
        </linearGradient>
        {/*
          The light the aurora casts: a wide, soft glow in the sky behind the
          curtains, a violet haze above them, and a fainter glow on the water.
          Gradients rather than blurs: smooth at any size and cheap to draw.
        */}
        <radialGradient id="aurora-painting-sky-glow">
          <stop offset="0" stopColor="var(--color-aurora)" stopOpacity="0.2" />
          <stop offset="0.55" stopColor="var(--color-teal)" stopOpacity="0.07" />
          <stop offset="1" stopColor="var(--color-teal)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="aurora-painting-high-glow">
          <stop offset="0" stopColor="var(--color-violet)" stopOpacity="0.12" />
          <stop offset="1" stopColor="var(--color-violet)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="aurora-painting-water-glow">
          <stop offset="0" stopColor="var(--color-aurora)" stopOpacity="0.1" />
          <stop offset="1" stopColor="var(--color-aurora)" stopOpacity="0" />
        </radialGradient>
        {/*
          Blurs, with their regions set in the painting's own units
          (userSpaceOnUse). By default a filter's region is sized from the
          shape's outline, which ignores stroke width, and the blur gets cut
          off in a hard-edged band.
        */}
        <filter id="aurora-painting-glow" filterUnits="userSpaceOnUse" x="-20" y="0" width={W + 40} height={HORIZON}>
          <feGaussianBlur stdDeviation="10" />
        </filter>
        {/* The reflection is softened more up and down than sideways, like light smeared by moving water. */}
        <filter id="aurora-painting-soften" filterUnits="userSpaceOnUse" x="-10" y={HORIZON} width={W + 20} height={H - HORIZON}>
          <feGaussianBlur stdDeviation="1.2 2.4" />
        </filter>
      </defs>

      <rect width={W} height={HORIZON} fill="url(#aurora-painting-sky)" />
      <g fill="none" strokeLinecap="round">
        <Strokes groups={LAYERS.sky} />
      </g>
      <ellipse cx="185" cy="108" rx="250" ry="88" fill="url(#aurora-painting-sky-glow)" />
      <ellipse cx="210" cy="50" rx="210" ry="50" fill="url(#aurora-painting-high-glow)" />
      <path
        d={`M-10 ${r1(curtainBase(-10) - 18)}${Array.from({ length: 17 }, (_, i) => {
          const x = (i + 1) * (W / 16);
          return `L${r1(x)} ${r1(curtainBase(x) - 18)}`;
        }).join("")}`}
        fill="none"
        stroke="var(--color-aurora)"
        strokeWidth="44"
        opacity="0.2"
        filter="url(#aurora-painting-glow)"
      />
      <g fill="none" strokeLinecap="round">
        <Strokes groups={LAYERS.curtain} />
      </g>

      <rect y={HORIZON} width={W} height={H - HORIZON} fill="url(#aurora-painting-water)" />
      <ellipse cx="185" cy={HORIZON + 34} rx="230" ry="36" fill="url(#aurora-painting-water-glow)" />
      <g fill="none" strokeLinecap="round" filter="url(#aurora-painting-soften)">
        <Strokes groups={LAYERS.reflection} />
      </g>
      <g fill="none" strokeLinecap="round">
        <Strokes groups={LAYERS.water} />
      </g>

      <path d={FAR_SHORE} fill="var(--color-deep)" />
      <path d={HEADLAND} fill="var(--color-deep)" />
    </svg>
  );
}
