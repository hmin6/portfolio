import { between, r1, seeded } from "./random";

/*
 * Aurora's painting for The Collection: aurora curtains over a dark shoreline
 * and still water. It's a different scene from the hero's canal, painted in
 * the same spirit: a flat underpaint, then layers of short, semi-transparent
 * brushstrokes, each slightly curved, with round ends.
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

/** How tall the curtain's rays are at x: tallest left of center, where it's brightest. */
function curtainHeight(x: number): number {
  return 48 + 46 * Math.exp(-(((x - 150) / 120) ** 2)) + 10 * Math.sin((x / W) * Math.PI * 3 + 2);
}

/**
 * Paints the picture as groups of strokes.
 *
 * Strokes that share a layer, color, width, and opacity are merged into one
 * <path> (each stroke is its own "M…" piece of it). A Server Component's output is
 * sent twice: once as HTML and once in the React Server Components payload
 * React reads when it takes over the page. An early version, with every
 * stroke its own path and attributes, was 557 paths and 63 KB of HTML.
 * Grouped, this one is about 100 paths and 33 KB, with more strokes.
 *
 * The trade-off: strokes inside one path don't build up where they cross
 * the way separate translucent strokes do. Widths and opacities are rounded
 * to a few steps so groups are large, and layering still happens between
 * groups and between layers, which are painted in order.
 */
function paint(): StrokeGroup[] {
  const rand = seeded(2026);
  const groups = new Map<string, StrokeGroup>();
  let layer = 0;
  const add = (d: string, color: string, width: number, opacity: number) => {
    const w = Math.max(1, Math.round(width));
    const o = Math.max(0.1, Math.round(opacity * 10) / 10);
    const key = `${layer}|${color}|${w}|${o}`;
    const group = groups.get(key);
    if (group) group.d += d;
    // A Map keeps insertion order, so groups come out layer by layer.
    else groups.set(key, { d, color, width: w, opacity: o });
  };

  // 1. Sky texture: wide, nearly horizontal dabs over the gradient, darker
  //    at the top and lifting toward the horizon.
  for (let i = 0; i < 70; i++) {
    const x = between(rand, -20, W);
    const y = between(rand, 0, HORIZON - 6);
    const len = between(rand, 18, 42);
    const tilt = between(rand, -3, 3);
    const color = y < 90 ? "var(--color-night)" : "var(--color-panel)";
    add(curve(x, y, x + len / 2, y + tilt - 1.5, x + len, y + tilt), color, between(rand, 5, 10), between(rand, 0.35, 0.6));
  }

  layer++;
  // 2. Stars: dots, which a zero-length stroke with round ends draws.
  for (let i = 0; i < 46; i++) {
    const x = between(rand, 0, W);
    const y = between(rand, 2, 150);
    add(`M${r1(x)} ${r1(y)}h0`, "var(--color-starlight)", between(rand, 1, 2.4), between(rand, 0.35, 0.9));
  }

  layer++;
  // 3. The aurora's rays: thin vertical strokes rising from the curtain's
  //    lower edge, green at the bottom, teal higher up, and a faint violet
  //    fringe at the top, like the real thing (oxygen glows green lower in
  //    the sky; nitrogen adds violet at the top). Neighboring rays lean the
  //    same way and reach similar heights, so they read as one draped
  //    curtain rather than separate stalks. A smaller, fainter curtain
  //    farther away, higher and to the right, adds depth.
  const curtain = (count: number, from: number, to: number, base: (x: number) => number, height: (x: number) => number, strength: number) => {
    for (let i = 0; i < count; i++) {
      const x = between(rand, from, to);
      const y = base(x) + between(rand, -2, 4);
      const h = height(x) * between(rand, 0.7, 1);
      const lean = 6 * Math.sin((x / W) * Math.PI * 2 + 1) + between(rand, -1, 1);
      const width = between(rand, 1.5, 3.5);
      const bend = between(rand, -1.5, 1.5);
      add(curve(x, y, x + lean * 0.3 + bend, y - h * 0.3, x + lean * 0.55, y - h * 0.55), "var(--color-aurora)", width, between(rand, 0.15, 0.35) * strength);
      add(
        curve(x + lean * 0.45, y - h * 0.45, x + lean * 0.7 + bend, y - h * 0.7, x + lean * 0.9, y - h * 0.9),
        "var(--color-teal)",
        width,
        between(rand, 0.1, 0.25) * strength,
      );
      add(curve(x + lean * 0.85, y - h * 0.85, x + lean * 0.95, y - h * 0.95, x + lean * 1.05, y - h * 1.08), "var(--color-violet)", width, between(rand, 0.1, 0.2) * strength);
    }
  };
  curtain(60, 210, W + 6, (x) => 104 + 6 * Math.sin(x / 30), () => 34, 0.7);
  curtain(220, -6, W + 6, curtainBase, curtainHeight, 1);

  layer++;
  // 4. The curtain's bright lower hem: many short, faint strokes just above
  //    its edge, so it glows instead of reading as a hard line.
  for (let i = 0; i < 70; i++) {
    const x = between(rand, -6, W);
    const len = between(rand, 4, 10);
    const lift = between(rand, 0, 5);
    const y1 = curtainBase(x) - lift;
    const y2 = curtainBase(x + len) - lift;
    add(curve(x, y1, x + len / 2, (y1 + y2) / 2, x + len, y2), "var(--color-aurora)", between(rand, 1, 2), between(rand, 0.2, 0.45));
  }

  layer++;
  // 5. Water: the aurora's reflection as short horizontal strokes, fading
  //    with depth, broken up by dark ripples.
  for (let i = 0; i < 64; i++) {
    const x = between(rand, -10, W);
    const y = between(rand, HORIZON + 4, H - 6);
    const depth = (y - HORIZON) / (H - HORIZON);
    const len = between(rand, 10, 30);
    const color = rand() < 0.65 ? "var(--color-aurora)" : "var(--color-teal)";
    add(curve(x, y, x + len / 2, y + 0.6, x + len, y), color, between(rand, 1.2, 2.8), between(rand, 0.12, 0.38) * (1 - depth * 0.7));
  }
  for (let i = 0; i < 40; i++) {
    const x = between(rand, -10, W);
    const y = between(rand, HORIZON + 2, H);
    const len = between(rand, 20, 50);
    add(curve(x, y, x + len / 2, y - 0.8, x + len, y), "var(--color-deep)", between(rand, 2, 5), between(rand, 0.3, 0.6));
  }

  return [...groups.values()];
}

/** Painted once, when this module first loads on the server. */
const STROKES = paint();

/** The far shore, and a headland rising out of the water at the lower left. */
const FAR_SHORE = `M0 ${HORIZON - 9}C60 ${HORIZON - 14} 110 ${HORIZON - 4} 170 ${HORIZON - 6}S290 ${HORIZON - 3} ${W} ${HORIZON - 7}V${HORIZON + 1}H0Z`;
const HEADLAND = `M0 236C40 236 80 244 112 262S150 292 162 ${H}H0Z`;

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
          A soft glow under the curtain: a wide stroke, blurred. The filter's
          region is set in the painting's own units (userSpaceOnUse), the
          whole sky. By default it's sized from the path's outline, which
          ignores stroke width, so the blur was cut off in a hard-edged band.
        */}
        <filter id="aurora-painting-glow" filterUnits="userSpaceOnUse" x="-20" y="0" width={W + 40} height={HORIZON}>
          <feGaussianBlur stdDeviation="10" />
        </filter>
      </defs>

      <rect width={W} height={HORIZON} fill="url(#aurora-painting-sky)" />
      <rect y={HORIZON} width={W} height={H - HORIZON} fill="url(#aurora-painting-water)" />
      <path
        d={`M-10 ${r1(curtainBase(-10) - 18)}${Array.from({ length: 17 }, (_, i) => {
          const x = (i + 1) * (W / 16);
          return `L${r1(x)} ${r1(curtainBase(x) - 18)}`;
        }).join("")}`}
        fill="none"
        stroke="var(--color-aurora)"
        strokeWidth="44"
        opacity="0.22"
        filter="url(#aurora-painting-glow)"
      />

      <g fill="none" strokeLinecap="round">
        {STROKES.map((s, i) => (
          <path key={i} d={s.d} stroke={s.color} strokeWidth={s.width} opacity={s.opacity} />
        ))}
      </g>

      <path d={FAR_SHORE} fill="var(--color-deep)" />
      <path d={HEADLAND} fill="var(--color-deep)" />
    </svg>
  );
}
