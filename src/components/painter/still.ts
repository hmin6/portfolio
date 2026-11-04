import type { AuroraBand, SceneLayout, Viewport } from "./layout";
import { paintStrokes } from "./strokes";

/*
 * A finished still painting, for when motion is paused (Pause motion, or
 * prefers-reduced-motion). The live loop paints onto the visible canvas a
 * frame at a time, so a paused visitor would watch the canvas fill in. Here
 * every stroke goes onto a canvas that is never added to the page, and the
 * engine copies the result onto the visible canvas in one step once it's
 * complete. ADR-008 explains why this, and not a pre-rendered image.
 */

export interface StillInput {
  view: Viewport;
  layout: SceneLayout;
  /** A copy of the aurora band, so a later scene redraw can't change it mid-paint. */
  band: AuroraBand;
  /** The hidden scene's pixels, drawn once with the mode's finished palette. */
  pixels: ImageDataArray;
  /** Animation time in seconds, frozen while paused. */
  t: number;
}

/**
 * Layers of brushwork, coarse to fine, like a painter blocking in shapes
 * and then working over them. `layers` is how many times, on average, the
 * pass's strokes cover the canvas.
 *
 * - The large strokes block in the shapes (2.6× matches the largest
 *   strokes of the live opening reveal).
 * - The finished-size layers on top decide the look. The chance that a
 *   pixel is missed by all of them is about e^-layers (each stroke lands
 *   independently at random), so 3 layers leave about 5% to the layers
 *   below, close to the live painting, where the last few frames' strokes
 *   sit over older ones.
 */
const PASSES = [
  { sizeMul: 2.6, layers: 1 },
  { sizeMul: 1.6, layers: 1 },
  { sizeMul: 1, layers: 3 },
] as const;

/**
 * Average area of one stroke at sizeMul 1, in CSS pixels at the reference
 * desktop size (see STROKE_REFERENCE in layout.ts). Strokes range from small
 * dabs on walls (about 13×4.5) to long water strokes (about 41×3.75), and
 * shrink on edges.
 */
const MEAN_STROKE_AREA = 110;

/**
 * How long one chunk of painting may run before handing the main thread
 * back to the browser. Well under the 50 ms that counts as a long task, so
 * clicks, taps, and scrolling stay responsive while the still is painted.
 */
const SLICE_MS = 8;
/** Strokes painted between clock checks. */
const BATCH = 100;

/** How many strokes cover the canvas `layers` times at this size. */
function strokesFor(view: Viewport, sizeMul: number, layers: number): number {
  // Stroke lengths and widths are both scaled by `base` (see strokes.ts),
  // so their area scales by its square.
  const base = view.dpr * view.strokeScale * sizeMul;
  return Math.round((layers * view.width * view.height) / (MEAN_STROKE_AREA * base * base));
}

// The Prioritized Task Scheduling API isn't in TypeScript's DOM types yet.
interface SchedulerWithYield {
  yield(): Promise<void>;
}

/**
 * Lets the browser handle input and draw a frame, then continues.
 * scheduler.yield() resumes ahead of other queued tasks; where it doesn't
 * exist, a MessageChannel message resumes as soon as the browser is free.
 * (A chain of setTimeout(0) calls would wait at least 4 ms each after the
 * fifth, which adds up over a hundred chunks.)
 */
function yieldToBrowser(): Promise<void> {
  const scheduler = (globalThis as { scheduler?: Partial<SchedulerWithYield> }).scheduler;
  if (typeof scheduler?.yield === "function") return scheduler.yield();
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      channel.port1.close();
      resolve();
    };
    channel.port2.postMessage(null);
  });
}

/** The scene pixels on a canvas of their own, so they can be drawn scaled. */
function groundFrom({ view, pixels }: StillInput): HTMLCanvasElement | null {
  const canvas = document.createElement("canvas");
  canvas.width = view.sceneW;
  canvas.height = view.sceneH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.putImageData(new ImageData(pixels, view.sceneW, view.sceneH), 0, 0);
  return canvas;
}

/**
 * Paints a complete still off screen, in chunks of about SLICE_MS. Resolves
 * with the finished canvas, or null if `signal` was aborted first (a newer
 * still replaced this one, motion resumed, or the engine was destroyed).
 */
export async function paintStill(input: StillInput, signal: AbortSignal): Promise<HTMLCanvasElement | null> {
  const { view } = input;
  const canvas = document.createElement("canvas");
  canvas.width = view.width;
  canvas.height = view.height;
  const ctx = canvas.getContext("2d");
  const ground = groundFrom(input);
  if (!ctx || !ground) return null;
  // The ground: the small scene, smoothly stretched to full size. Strokes
  // shrink on edges (rooftops, window frames), so a few pixels there are
  // missed by every stroke. The live loop covers them over many seconds of
  // painting; a still has one go, and over the live loop's flat underpaint
  // they would show as specks of brown. Over the scene's own colors they
  // read as soft paint.
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(ground, 0, 0, view.width, view.height);
  ctx.lineCap = "round";

  const strokeInput = { ctx, view, layout: input.layout, band: input.band, pixels: input.pixels, t: input.t };
  for (const pass of PASSES) {
    let left = strokesFor(view, pass.sizeMul, pass.layers);
    while (left > 0) {
      const start = performance.now();
      while (left > 0 && performance.now() - start < SLICE_MS) {
        const n = Math.min(BATCH, left);
        paintStrokes(strokeInput, n, pass.sizeMul);
        left -= n;
      }
      await yieldToBrowser();
      if (signal.aborted) return null;
    }
  }
  return canvas;
}
