import { rgba, type RGB } from "./color";
import {
  LIGHT_VIOLET,
  WARM_GLOW,
  WHITE_GLOW,
  type ThemeColors,
} from "./palettes";

/**
 * Small offscreen images drawn once and then stamped many times per frame.
 * Stretching a ready-made gradient with drawImage is much cheaper than
 * building a new gradient for every aurora column or every glow.
 */
export interface Sprites {
  /** One vertical gradient per aurora curtain, bottom to top. */
  auroraStrips: readonly HTMLCanvasElement[];
  /** Soft round glow for lamps, windows, lanterns, and the sun. */
  glowWarm: HTMLCanvasElement;
  /** Soft white glow for sun glints on the water. */
  glowWhite: HTMLCanvasElement;
}

/** Makes a canvas that is never added to the page. */
export function createCanvas(
  width: number,
  height: number,
): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is not available");
  return [canvas, ctx];
}

/**
 * A 1×64 strip: solid `bottom` color at the lower edge, fading through a
 * half-transparent `top` color to nothing. Real aurora curtains are brightest
 * at their lower edge, so the scene stretches these strips upward.
 */
function makeStrip(bottom: Readonly<RGB>, top: Readonly<RGB>): HTMLCanvasElement {
  const [canvas, g] = createCanvas(1, 64);
  const gradient = g.createLinearGradient(0, 0, 0, 64);
  gradient.addColorStop(0, rgba(top, 0));
  gradient.addColorStop(0.5, rgba(top, 0.55));
  gradient.addColorStop(1, rgba(bottom, 1));
  g.fillStyle = gradient;
  g.fillRect(0, 0, 1, 64);
  return canvas;
}

/** A 64×64 radial glow: solid in the middle, fading to transparent. */
function makeGlow(color: Readonly<RGB>): HTMLCanvasElement {
  const [canvas, g] = createCanvas(64, 64);
  const gradient = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, rgba(color, 1));
  gradient.addColorStop(0.35, rgba(color, 0.45));
  gradient.addColorStop(1, rgba(color, 0));
  g.fillStyle = gradient;
  g.fillRect(0, 0, 64, 64);
  return canvas;
}

/** Browser only: call from the engine, never at module load. */
export function createSprites(theme: ThemeColors): Sprites {
  return {
    auroraStrips: [
      makeStrip(theme.aurora, theme.teal),
      makeStrip(theme.teal, theme.violet),
      makeStrip(LIGHT_VIOLET, theme.magenta),
    ],
    glowWarm: makeGlow(WARM_GLOW),
    glowWhite: makeGlow(WHITE_GLOW),
  };
}

/**
 * A tileable canvas-weave texture, returned as a data URL for CSS.
 *
 * The base is 50% grey because the weave layer uses `mix-blend-mode:
 * overlay`: overlay leaves colors unchanged where the texture is mid-grey and
 * lightens or darkens them where it is lighter or darker. Alternating light
 * and dark lines in both directions read as woven threads, and the random
 * specks break up the repetition.
 */
export function createWeaveTexture(): string {
  const size = 48;
  const [canvas, g] = createCanvas(size, size);
  g.fillStyle = "rgb(128,128,128)";
  g.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y += 3) {
    const v = 128 + ((y / 3) % 2 ? 14 : -14) + (Math.random() * 10 - 5);
    g.fillStyle = `rgba(${v},${v},${v},.6)`;
    g.fillRect(0, y, size, 1.4);
  }
  for (let x = 0; x < size; x += 3) {
    const v = 128 + ((x / 3) % 2 ? 12 : -12) + (Math.random() * 10 - 5);
    g.fillStyle = `rgba(${v},${v},${v},.45)`;
    g.fillRect(x, 0, 1.4, size);
  }
  for (let i = 0; i < 220; i++) {
    const v = Math.random() * 255;
    g.fillStyle = `rgba(${v},${v},${v},.12)`;
    g.fillRect(Math.random() * size, Math.random() * size, 1, 1);
  }
  return canvas.toDataURL();
}
