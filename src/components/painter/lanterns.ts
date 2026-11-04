import type { Rect, Viewport } from "./layout";

/** A floating lantern. Position in scene pixels, speed in scene pixels per second. */
export interface Lantern {
  x: number;
  y: number;
  vx: number;
  /** Random phase for bobbing and flicker. */
  seed: number;
}

/** Oldest lanterns are dropped past this many. */
export const MAX_LANTERNS = 14;

/** The three lanterns already on the water when the page loads. */
export function seedLanterns(view: Viewport): Lantern[] {
  const { sceneW: SW, sceneH: SH } = view;
  const lanterns: Lantern[] = [];
  for (let i = 0; i < 3; i++) {
    lanterns.push({
      x: SW * (0.3 + i * 0.17),
      y: SH * (0.6 + i * 0.07),
      vx: SW * (0.004 + Math.random() * 0.004),
      seed: Math.random() * 10,
    });
  }
  return lanterns;
}

/** Side length of a lantern in scene pixels. */
export function lanternSize(view: Viewport): number {
  return Math.max(2.2, view.sceneW * 0.008);
}

/** How far a lantern bobs up and down, in scene pixels. */
export const LANTERN_BOB = 1.2;

/**
 * The scene-pixel box a lantern can paint into: the lantern at the top of
 * its bob down to the end of its reflection streaks (see drawLanterns in
 * scene.ts), plus a small margin. Used to repaint just this area while
 * motion is paused.
 */
export function lanternBounds(lantern: Lantern, view: Viewport): Rect {
  const size = lanternSize(view);
  const top = lantern.y - size - LANTERN_BOB - 2;
  // Five streaks, 2 px apart, starting 2 px below the lantern, each 1 px tall.
  const bottom = lantern.y + LANTERN_BOB + 2 + 4 * 2 + 1 + 2;
  return { x: lantern.x - size - 2, y: top, width: size * 2 + 4, height: bottom - top };
}

/**
 * Adds a lantern at (x, y) in scene pixels. Changes the array in place.
 * Returns the oldest lantern if it had to be dropped to make room, so the
 * caller can repaint the spot it left.
 */
export function addLantern(
  lanterns: Lantern[],
  view: Viewport,
  x: number,
  y: number,
): Lantern | undefined {
  const dropped = lanterns.length >= MAX_LANTERNS ? lanterns.shift() : undefined;
  lanterns.push({
    x,
    y,
    vx: view.sceneW * (0.004 + Math.random() * 0.005),
    seed: Math.random() * 10,
  });
  return dropped;
}

/**
 * Drifts lanterns to the right, drops any that have floated off the edge,
 * and now and then launches a new one from the left.
 */
export function updateLanterns(
  lanterns: Lantern[],
  view: Viewport,
  dt: number,
  canSpawn: boolean,
): Lantern[] {
  for (const lantern of lanterns) lantern.x += lantern.vx * dt;
  const kept = lanterns.filter((lantern) => lantern.x < view.sceneW + 10);

  // The chance of a spawn this frame is dt × 0.15. Summed over a second
  // that's 0.15 whatever the frame rate, so on average one new lantern
  // appears every 1 / 0.15 ≈ 7 seconds.
  if (canSpawn && kept.length < 2 && Math.random() < dt * 0.15) {
    const { sceneH: SH, horizon: hy } = view;
    addLantern(kept, view, -4, hy + (SH - hy) * (0.15 + Math.random() * 0.6));
  }
  return kept;
}
