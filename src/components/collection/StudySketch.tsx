import type { Project } from "@/app/projects";
import { between, r1, seeded } from "./random";

/*
 * Pencil studies for planned projects. A study is meant to look unfinished:
 * monochrome line art in `mist`, no color, no frame. Lines wobble and run a
 * little past their ends, every shape is drawn twice (a firm line and a
 * fainter, looser one, like a sketch gone over), and there are faint
 * dashed construction lines and some hatching for shadow.
 *
 * Like the Aurora painting, it's an SVG made on the server from a seeded
 * generator (ADR-010): no JavaScript, no motion, the same drawing every
 * build. The shapes are authored in a 400 × 240 space.
 */

const W = 400;
const H = 240;

type Pt = readonly [number, number];

const fmt = (p: Pt) => `${r1(p[0])} ${r1(p[1])}`;
const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/**
 * A smooth path through points: each point becomes the control point of a
 * quadratic curve that runs between the midpoints on either side of it, so
 * the line bends through the shape's corners instead of turning sharply.
 */
function smoothPath(pts: readonly Pt[], closed: boolean): string {
  if (pts.length < 3) return `M${pts.map(fmt).join("L")}`;
  if (closed) {
    const n = pts.length;
    let d = `M${fmt(mid(pts[n - 1], pts[0]))}`;
    for (let i = 0; i < n; i++) d += `Q${fmt(pts[i])} ${fmt(mid(pts[i], pts[(i + 1) % n]))}`;
    return d;
  }
  let d = `M${fmt(pts[0])}`;
  for (let i = 1; i < pts.length - 1; i++) d += `Q${fmt(pts[i])} ${fmt(mid(pts[i], pts[i + 1]))}`;
  return `${d}L${fmt(pts[pts.length - 1])}`;
}

/** Points around an ellipse, rotated by `deg`. */
function ellipse(cx: number, cy: number, rx: number, ry: number, deg = 0, n = 20): Pt[] {
  const a = (deg * Math.PI) / 180;
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    const x = Math.cos(t) * rx;
    const y = Math.sin(t) * ry;
    return [cx + x * Math.cos(a) - y * Math.sin(a), cy + x * Math.sin(a) + y * Math.cos(a)] as Pt;
  });
}

/** Moves points drawn around (0, 0) to (ox, oy), rotated clockwise by `deg`. */
function place(pts: readonly Pt[], ox: number, oy: number, deg: number): Pt[] {
  const a = (deg * Math.PI) / 180;
  return pts.map(([x, y]) => [ox + x * Math.cos(a) - y * Math.sin(a), oy + x * Math.sin(a) + y * Math.cos(a)] as Pt);
}

interface SketchPaths {
  /** The firm lines. */
  line: string;
  /** The fainter second pass. */
  ghost: string;
  hatch: string;
  /** Dashed construction lines. */
  guide: string;
}

/**
 * Collects a sketch's strokes into four paths, one per pencil style. Each
 * style is a single <path> with many pieces, which keeps the page small,
 * and suits pencil: where two lines in one path cross, they don't darken
 * each other.
 */
function sketcher(seed: number) {
  const rand = seeded(seed);
  const parts = { line: [] as string[], ghost: [] as string[], hatch: [] as string[], guide: [] as string[] };
  const wobble = (pts: readonly Pt[], amount: number) =>
    pts.map(([x, y]) => [x + between(rand, -amount, amount), y + between(rand, -amount, amount)] as Pt);

  const shape = (pts: readonly Pt[], closed = false) => {
    parts.line.push(smoothPath(wobble(pts, 0.6), closed));
    parts.ghost.push(smoothPath(wobble(pts, 1.6), closed));
  };

  /** One quick hatching stroke. */
  const tick = (a: Pt, b: Pt) => {
    const [p, q] = wobble([a, b], 0.8);
    parts.hatch.push(`M${fmt(p)}L${fmt(q)}`);
  };

  /** A straight line, drawn by hand: it overshoots both ends a little and wavers. */
  const line = (a: Pt, b: Pt) => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const over = between(rand, 2, 4) / len;
    const start = lerp(a, b, -over);
    const end = lerp(a, b, 1 + over);
    shape([start, lerp(start, end, 0.33), lerp(start, end, 0.66), end]);
  };

  return {
    /** A curved shape (smooth through its points), for organic outlines. */
    shape,
    tick,
    line,
    /**
     * A shape with corners, drawn edge by edge. `shape` would round a
     * trapezoid into an egg; separate overshooting lines keep the corners,
     * crossing slightly the way pencil edges do.
     */
    poly(pts: readonly Pt[]) {
      pts.forEach((p, i) => line(p, pts[(i + 1) % pts.length]));
    },
    /** Hatching: n short strokes from points along edge a0→a1 to matching points along b0→b1. */
    hatch(a0: Pt, a1: Pt, b0: Pt, b1: Pt, n: number) {
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        tick(lerp(a0, a1, t), lerp(b0, b1, t));
      }
    },
    guide(pts: readonly Pt[], closed = false) {
      parts.guide.push(smoothPath(pts, closed));
    },
    done(): SketchPaths {
      return { line: parts.line.join(""), ghost: parts.ghost.join(""), hatch: parts.hatch.join(""), guide: parts.guide.join("") };
    },
  };
}

/** Woodshed: a guitar headstock, tilted, beside a metronome. */
function woodshed(): SketchPaths {
  const s = sketcher(17);

  // Construction lines: the table and the metronome's center line.
  s.guide([[16, 212], [384, 212]]);
  s.guide([[290, 52], [290, 222]]);

  // The guitar, drawn upright around the nut at (0, 0), then tilted 30°
  // and moved so the neck runs out of the bottom left of the drawing.
  const g = (pts: Pt[]) => place(pts, 118, 156, 30);
  // Neck, strings, and frets.
  s.line(g([[-11, 0]])[0], g([[-14, 150]])[0]);
  s.line(g([[11, 0]])[0], g([[14, 150]])[0]);
  for (let i = 0; i < 6; i++) {
    const x = -8.5 + i * 3.4;
    s.line(g([[x, -2]])[0], g([[x * 1.2, 150]])[0]);
  }
  for (const y of [20, 39, 56, 72]) s.line(g([[-12, y]])[0], g([[12, y]])[0]);
  // Nut and headstock outline.
  s.line(g([[-12, 0]])[0], g([[12, 0]])[0]);
  s.shape(g([[-12, 0], [-17, -20], [-22, -70], [-18, -96], [0, -106], [18, -96], [22, -70], [17, -20], [12, 0]]));
  // Tuning posts on the face, and the pegs sticking out to the sides.
  for (const [i, y] of [-30, -52, -74].entries()) {
    for (const side of [-1, 1]) {
      s.shape(g(ellipse(side * 12, y, 2.6, 2.6, 0, 10)), true);
      s.line(g([[side * 22, y]])[0], g([[side * 27, y]])[0]);
      s.shape(g(ellipse(side * 33, y, 6.5, 4, 0, 14)), true);
      // A string from the nut to each post.
      const nutX = side * (1.7 + (2 - i) * 3.4);
      s.line(g([[nutX, -2]])[0], g([[side * 12, y + 2.6]])[0]);
    }
  }
  // Shading down one side of the headstock.
  s.hatch(g([[14, -10]])[0], g([[20, -80]])[0], g([[19, -12]])[0], g([[25, -78]])[0], 9);

  // The metronome: a tall pyramid on a plinth, with its face window,
  // scale marks, and the pendulum swung slightly to one side.
  s.poly([[248, 200], [332, 200], [301, 62], [279, 62]]);
  s.poly([[238, 200], [342, 200], [342, 212], [238, 212]]);
  s.poly([[268, 186], [312, 186], [298, 92], [282, 92]]);
  for (let y = 102; y <= 172; y += 10) s.line([288, y], [292, y]);
  s.line([290, 182], [307, 84]);
  s.poly([[296, 132], [306, 134], [304, 144], [294, 142]]);
  s.shape(ellipse(290, 182, 3, 3, 0, 10), true);
  // Shading on the right side, and a cast shadow on the table.
  s.hatch([312, 186], [298, 92], [332, 200], [301, 62], 12);
  s.hatch([342, 212], [360, 212], [348, 204], [370, 206], 6);

  return s.done();
}

/** Pigment: a painter's palette with empty paint wells, and a brush across it. */
function pigment(): SketchPaths {
  const s = sketcher(29);
  const cx = 186;
  const cy = 120;

  // Construction: the plain oval the palette was drawn from.
  s.guide(ellipse(cx, cy, 152, 84, -8, 28), true);

  // The palette: an oval with a notch on the left, where the thumb sits.
  const outline: Pt[] = Array.from({ length: 36 }, (_, i) => {
    const t = (i / 36) * Math.PI * 2;
    // A dip in the radius around the left side (t = π) makes the notch.
    const notch = 1 - 0.2 * Math.exp(-(((t - Math.PI) / 0.32) ** 2));
    const x = Math.cos(t) * 148 * notch;
    const y = Math.sin(t) * 80 * notch;
    const a = (-8 * Math.PI) / 180;
    return [cx + x * Math.cos(a) - y * Math.sin(a), cy + x * Math.sin(a) + y * Math.cos(a)] as Pt;
  });
  s.shape(outline, true);
  s.shape(ellipse(cx - 98, cy + 22, 15, 11, -8, 14), true);

  // Six empty wells along the upper edge.
  for (let i = 0; i < 6; i++) {
    const t = Math.PI * (1.15 + i * 0.15);
    const a = (-8 * Math.PI) / 180;
    const x = Math.cos(t) * 112;
    const y = Math.sin(t) * 52;
    s.shape(ellipse(cx + x * Math.cos(a) - y * Math.sin(a), cy + x * Math.sin(a) + y * Math.cos(a), 12, 10, -8, 14), true);
  }

  // A cast shadow under the palette's lower right edge.
  for (let i = 2; i <= 14; i++) {
    const [x, y] = outline[i];
    s.tick([x + 2, y + 2], [x + 8, y + 8]);
  }

  // The brush, lying across the palette: handle, metal ferrule, bristles.
  const start: Pt = [206, 222];
  const tip: Pt = [374, 90];
  const len = Math.hypot(tip[0] - start[0], tip[1] - start[1]);
  const u: Pt = [(tip[0] - start[0]) / len, (tip[1] - start[1]) / len];
  const n: Pt = [-u[1], u[0]];
  /** A point `t` of the way along the brush, `w` to one side of its center line. */
  const at = (t: number, w: number): Pt => [start[0] + u[0] * len * t + n[0] * w, start[1] + u[1] * len * t + n[1] * w];
  s.shape([at(0, -2.6), at(0.35, -3.8), at(0.68, -5.2)]);
  s.shape([at(0, 2.6), at(0.35, 3.8), at(0.68, 5.2)]);
  s.line(at(0, -2.6), at(0, 2.6));
  s.poly([at(0.68, -5.6), at(0.8, -5.6), at(0.8, 5.6), at(0.68, 5.6)]);
  s.shape([at(0.8, -5.6), at(0.88, -6.4), at(0.96, -2.6), at(1, 0), at(0.96, 2.6), at(0.88, 6.4), at(0.8, 5.6)]);
  s.hatch(at(0.7, 2), at(0.78, 2), at(0.7, 5.6), at(0.78, 5.6), 4);

  return s.done();
}

/**
 * A sketch for each project that has one. Partial: a project only needs a
 * study while it's planned. Once it's in progress, it's framed as a
 * painting instead (kindOf in projects.ts).
 */
const SKETCHES: Partial<Record<Project["slug"], SketchPaths>> = {
  woodshed: woodshed(),
  pigment: pigment(),
};

export default function StudySketch({ slug, alt }: { slug: Project["slug"]; alt: string }) {
  const paths = SKETCHES[slug];
  if (!paths) return null;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={alt} className="block h-auto w-full">
      <g fill="none" stroke="var(--color-mist)" strokeLinecap="round" strokeLinejoin="round">
        <path d={paths.guide} stroke="var(--color-haze)" strokeWidth="0.8" strokeDasharray="4 5" opacity="0.22" />
        <path d={paths.hatch} strokeWidth="0.7" opacity="0.4" />
        <path d={paths.ghost} strokeWidth="0.8" opacity="0.35" />
        <path d={paths.line} strokeWidth="1.3" opacity="0.8" />
      </g>
    </svg>
  );
}
