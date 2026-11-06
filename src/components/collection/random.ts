/*
 * A seeded random number generator for the Collection's artwork.
 *
 * The artwork is drawn on the server, while the page is prerendered at build
 * time. With Cache Components, Math.random() during a prerender is an error:
 * its value differs on every call, so Next.js can't tell whether the output
 * is safe to bake into static HTML. A seeded generator is pure computation:
 * the same seed always gives the same numbers, so the same picture, and the
 * page stays static. It also means a painting only changes when its code does.
 */

/**
 * mulberry32: a tiny, fast 32-bit generator, plenty for placing brushstrokes
 * (not for anything security-related). Each call scrambles a running state
 * with multiplies and shifts and returns a float in [0, 1).
 */
export function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A random number in [min, max). */
export function between(rand: () => number, min: number, max: number): number {
  return min + rand() * (max - min);
}

/** One decimal place: enough precision for an SVG, and it keeps the HTML small. */
export function r1(n: number): number {
  return Math.round(n * 10) / 10;
}
