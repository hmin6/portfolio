import { rgba } from "./color";
import {
  addLantern,
  lanternBounds,
  seedLanterns,
  updateLanterns,
  type Lantern,
} from "./lanterns";
import { createLayout, createViewport, type AuroraBand, type Rect, type Viewport } from "./layout";
import { drawLights } from "./lights";
import {
  clonePalette,
  isPaletteSettled,
  lerpPalette,
  PALETTES,
  readThemeColors,
  type ModeId,
} from "./palettes";
import { drawScene } from "./scene";
import { createSprites, createWeaveTexture } from "./sprites";
import { paintStrokes, StrokeBudget } from "./strokes";

/*
 * The painter engine: plain TypeScript with no React. It owns the canvases,
 * the frame loop, and every listener and observer. PaintedHero.tsx creates
 * one when it mounts and destroys it when it unmounts. ADR-006 explains why
 * the engine lives outside React.
 */

export interface PainterElements {
  /** The hero section: measured for size, observed for visibility. */
  hero: HTMLElement;
  /** Visible canvas the brushstrokes accumulate on. */
  paint: HTMLCanvasElement;
  /** Visible canvas for the glow layer, cleared every frame. */
  lights: HTMLCanvasElement;
  /** Element that gets the canvas-weave texture as its background. */
  weave: HTMLElement;
}

export interface PainterOptions {
  mode: ModeId;
  /**
   * The visitor's explicit Pause motion choice, or null if they haven't
   * pressed it. When null, prefers-reduced-motion decides.
   */
  userPaused: boolean | null;
}

export interface Painter {
  setMode(mode: ModeId): void;
  setUserPaused(paused: boolean | null): void;
  /** Launches a lantern near the left side of the canal. */
  floatLantern(): void;
  /** Launches a lantern where the visitor clicked, if that point is water. */
  lanternAt(clientX: number, clientY: number): void;
  /** Stops the loop and removes every listener and observer. Safe to call twice. */
  destroy(): void;
}

export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Whether motion is paused: the visitor's explicit choice wins; otherwise
 * prefers-reduced-motion decides. PaintedHero uses the same function for
 * the Pause motion button, so the button and the engine can't disagree.
 */
export function resolvePaused(userPaused: boolean | null, prefersReducedMotion: boolean): boolean {
  return userPaused ?? prefersReducedMotion;
}

/*
 * While paused, the engine only paints what is out of date:
 *
 * - Full repaint: the whole canvas, for REPAINT_FRAMES frames. Only when the
 *   canvas isn't fully painted: first load, a resize, a mode change, or a
 *   pause before the opening reveal or a mode blend has finished.
 * - Catch-up: pausing a finished painting. Paint for CATCH_UP_MS so the
 *   last strokes land on the frozen scene, then stop.
 * - Local pass: a lantern added while paused. Paint only a small box around
 *   it, densely, for LOCAL_PASS_FRAMES frames.
 */

/** Full-canvas frames needed to cover the canvas (~2 s at 60 fps). */
const REPAINT_FRAMES = 110;
/** Time, not frames, so slow devices don't keep moving longer. */
const CATCH_UP_MS = 250;
const LOCAL_PASS_FRAMES = 3;
/**
 * A local pass paints this many times the usual stroke density, so a few
 * frames are enough to cover its small area.
 */
const LOCAL_DENSITY = 20;
/** Opening frames that paint extra, larger strokes to cover the blank canvas quickly. */
const REVEAL_FRAMES = 90;
const RESIZE_DEBOUNCE_MS = 150;

/** An area to repaint while paused, in device pixels. */
interface LocalPass {
  area: Rect;
  framesLeft: number;
}

/** Stroke budget ceiling: lower on narrow (usually slower, smaller) screens. */
function maxStrokes(view: Viewport): number {
  return view.narrow ? 900 : 1800;
}

/**
 * Starts painting into the given elements. Browser only: call it from an
 * effect. Returns null if the browser can't give us a 2D canvas.
 */
export function createPainter(el: PainterElements, options: PainterOptions): Painter | null {
  const sceneCanvas = document.createElement("canvas");
  const paintCtx = el.paint.getContext("2d");
  const lightsCtx = el.lights.getContext("2d");
  // willReadFrequently: getImageData runs on this canvas every frame. The
  // hint keeps it in regular memory so reads don't wait on the GPU.
  const sceneCtx = sceneCanvas.getContext("2d", { willReadFrequently: true });
  if (!paintCtx || !lightsCtx || !sceneCtx) return null;
  // Grouped after the null check so the functions below see non-null types.
  const ctx = { paint: paintCtx, lights: lightsCtx, scene: sceneCtx };

  const theme = readThemeColors();
  const sprites = createSprites(theme);
  el.weave.style.backgroundImage = `url(${createWeaveTexture()})`;

  // Reduced motion applies from the first frame: read the media query here
  // instead of waiting for React, whose value isn't known until after
  // hydration.
  const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY);
  let userPaused = options.userPaused;
  let running = !resolvePaused(userPaused, reducedMotion.matches);

  let target = PALETTES[options.mode];
  const palette = clonePalette(target);

  let view = measure();
  let layout = createLayout(view);
  const band: AuroraBand = [];
  let lanterns: Lantern[] = seedLanterns(view);
  const budget = new StrokeBudget(maxStrokes(view));
  sizeCanvases();

  /** Animation time in seconds. Only advances while motion is running. */
  let t = 0;
  /** Full-canvas frames painted since the last resize. */
  let frames = 0;
  // Paused work (see the comment above REPAINT_FRAMES). A blank canvas that
  // starts paused, e.g. for reduced motion, needs a full repaint.
  let repaintFrames = running ? 0 : REPAINT_FRAMES;
  let catchUpMs = 0;
  let localPasses: LocalPass[] = [];
  let onScreen = true;
  let tabVisible = document.visibilityState === "visible";
  /** Pending requestAnimationFrame id, or 0 if none is scheduled. */
  let rafId = 0;
  /** Timestamp of the previous frame, or null right after waking from idle. */
  let lastTime: number | null = null;
  let resizeTimer: ReturnType<typeof setTimeout> | undefined;
  let destroyed = false;

  // One AbortController removes every event listener at once on destroy:
  // each addEventListener below passes its `signal`.
  const listeners = new AbortController();
  const { signal } = listeners;

  function measure(): Viewport {
    const rect = el.hero.getBoundingClientRect();
    return createViewport(rect.width, rect.height, window.devicePixelRatio);
  }

  /** Applies `view` to the canvases and lays down the base color. */
  function sizeCanvases(): void {
    // Setting a canvas's width or height clears it and resets its context
    // settings, so lineCap has to be set again afterward.
    el.paint.width = el.lights.width = view.width;
    el.paint.height = el.lights.height = view.height;
    sceneCanvas.width = view.sceneW;
    sceneCanvas.height = view.sceneH;
    ctx.paint.lineCap = "round";
    ctx.paint.fillStyle = rgba(palette.underpaint);
    ctx.paint.fillRect(0, 0, view.width, view.height);
  }

  function resize(): void {
    if (destroyed) return;
    const next = measure();
    // The ResizeObserver also fires once when it starts watching. Skip that
    // call (and any other no-op) so the painting isn't wiped for nothing.
    if (next.width === view.width && next.height === view.height && next.dpr === view.dpr) {
      return;
    }
    view = next;
    layout = createLayout(view);
    budget.setMax(maxStrokes(view));
    sizeCanvases();
    frames = 0;
    // Resizing clears the canvas, so a paused hero needs a full repaint.
    startRepaint();
    if (lanterns.length === 0) lanterns = seedLanterns(view);
    wake();
  }

  function startRepaint(): void {
    repaintFrames = REPAINT_FRAMES;
    catchUpMs = 0;
    localPasses = [];
  }

  /*
   * The frame loop only runs while there is something to draw: motion is
   * running, or paused work is left. When the hero is off screen or the
   * tab is hidden, or paused work is done, it stops scheduling frames
   * entirely, and wake() restarts it when something changes.
   */
  function canDraw(): boolean {
    return onScreen && tabVisible;
  }
  function hasPausedWork(): boolean {
    return repaintFrames > 0 || catchUpMs > 0 || localPasses.length > 0;
  }
  function needsFrame(): boolean {
    return canDraw() && (running || hasPausedWork());
  }

  /** Restarts the loop if it is idle and there is something to draw. */
  function wake(): void {
    if (destroyed || rafId !== 0 || !needsFrame()) return;
    // The time spent idle shouldn't count as animation time.
    lastTime = null;
    rafId = requestAnimationFrame(frame);
  }

  function frame(now: number): void {
    rafId = 0;
    if (destroyed) return;
    // Time since the previous frame, from requestAnimationFrame's own
    // timestamps only. (Mixing in performance.now() breaks this: a frame's
    // timestamp is when the frame *began*, which can be earlier than the
    // end of the previous frame's work, so dt would come out at or below 0.)
    const elapsedMs = lastTime === null ? 0 : now - lastTime;
    lastTime = now;
    if (!needsFrame()) return;

    if (running) {
      // Capped at 50 ms so one slow frame doesn't make everything jump.
      const dt = Math.min(0.05, elapsedMs / 1000);
      t += dt;
      lanterns = updateLanterns(lanterns, view, dt, palette.windowLight > 0.3);
      // Frame-rate independent easing: each frame keeps 0.25^dt of the
      // remaining distance, so after one second 25% remains (75% done),
      // whether that second had 30 frames or 120.
      lerpPalette(palette, target, 1 - Math.pow(0.25, dt));
      paintWholeCanvas();
    } else if (repaintFrames > 0 || catchUpMs > 0) {
      // Paused, so t stays frozen. No clock to follow, so the palette
      // eases a fixed 20% per frame.
      lerpPalette(palette, target, 0.2);
      paintWholeCanvas();
      // A whole-canvas pass paints any new lanterns in too.
      localPasses = [];
      if (repaintFrames > 0) repaintFrames--;
      // At least 8 ms per frame, so catch-up always ends even if
      // timestamps repeat.
      else catchUpMs -= Math.max(elapsedMs, 8);
    } else {
      paintLocalPasses();
    }

    // Keep going without wake(), so lastTime carries over to the next frame.
    if (needsFrame()) rafId = requestAnimationFrame(frame);
  }

  /** Redraws the hidden scene and returns its pixels for the strokes. */
  function renderScene(): Uint8ClampedArray {
    drawScene({ ctx: ctx.scene, view, layout, palette, sprites, theme, lanterns, t, band });
    return ctx.scene.getImageData(0, 0, view.sceneW, view.sceneH).data;
  }

  function paintWholeCanvas(): void {
    const pixels = renderScene();
    // `reveal` goes from 1 to 0 over the opening frames: up to 80% more
    // strokes, up to 2.6× larger, to cover the blank canvas quickly.
    const reveal = Math.max(0, 1 - frames / REVEAL_FRAMES);
    const start = performance.now();
    paintStrokes(
      { ctx: ctx.paint, view, layout, band, pixels, t },
      Math.round(budget.count * (1 + reveal * 0.8)),
      1 + reveal * 1.6,
    );
    budget.record(performance.now() - start);
    drawLights({ ctx: ctx.lights, view, layout, palette, sprites, theme, lanterns, t });
    frames++;
  }

  /**
   * Paints only the small areas in `localPasses`. With t frozen, the hidden
   * scene and the light layer redraw exactly as before, apart from what
   * changed in those areas, so nothing else on screen moves.
   */
  function paintLocalPasses(): void {
    const pixels = renderScene();
    const canvasArea = view.width * view.height;
    for (const pass of localPasses) {
      // Same stroke density as a normal frame, times LOCAL_DENSITY.
      const share = (pass.area.width * pass.area.height) / canvasArea;
      const count = Math.max(40, Math.round(budget.count * share * LOCAL_DENSITY));
      paintStrokes({ ctx: ctx.paint, view, layout, band, pixels, t, area: pass.area }, count, 1);
      pass.framesLeft--;
    }
    localPasses = localPasses.filter((pass) => pass.framesLeft > 0);
    drawLights({ ctx: ctx.lights, view, layout, palette, sprites, theme, lanterns, t });
  }

  /** Converts a scene-pixel box to device pixels, clipped to the canvas. */
  function toDeviceRect(rect: Rect): Rect {
    const kx = view.width / view.sceneW;
    const ky = view.height / view.sceneH;
    const x0 = Math.max(0, rect.x * kx);
    const y0 = Math.max(0, rect.y * ky);
    const x1 = Math.min(view.width, (rect.x + rect.width) * kx);
    const y1 = Math.min(view.height, (rect.y + rect.height) * ky);
    return { x: x0, y: y0, width: Math.max(0, x1 - x0), height: Math.max(0, y1 - y0) };
  }

  function addLocalPass(lantern: Lantern): void {
    const area = toDeviceRect(lanternBounds(lantern, view));
    if (area.width > 0 && area.height > 0) {
      localPasses.push({ area, framesLeft: LOCAL_PASS_FRAMES });
    }
  }

  /** Recomputes `running` from the visitor's choice and the media query. */
  function updateRunning(): void {
    const next = !resolvePaused(userPaused, reducedMotion.matches);
    if (next === running) return;
    running = next;
    localPasses = [];
    if (running) {
      repaintFrames = 0;
      catchUpMs = 0;
    } else if (frames >= REPAINT_FRAMES && isPaletteSettled(palette, target)) {
      // The canvas is fully painted: let the last strokes land, then stop.
      repaintFrames = 0;
      catchUpMs = CATCH_UP_MS;
    } else {
      // Paused during the opening reveal or partway through a mode blend:
      // finish painting the canvas first.
      startRepaint();
    }
    wake();
  }

  function launchLantern(x: number, y: number): void {
    const dropped = addLantern(lanterns, view, x, y);
    if (running) return;
    // Paused: the lantern stays where it is. Paint just its spot, plus the
    // spot of any old lantern that was dropped to make room.
    addLocalPass(lanterns[lanterns.length - 1]);
    if (dropped) addLocalPass(dropped);
    wake();
  }

  /**
   * Watches for the device pixel ratio changing, e.g. when the window moves
   * to a screen with a different density. The query matches only the
   * current ratio, so it fires `change` when the ratio changes; then
   * re-measure and watch the new ratio.
   */
  function watchPixelRatio(): void {
    window
      .matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
      .addEventListener(
        "change",
        () => {
          resize();
          if (!destroyed) watchPixelRatio();
        },
        { once: true, signal },
      );
  }

  const resizeObserver = new ResizeObserver(() => {
    // Debounced: a window drag fires many resizes, and each one wipes the
    // painting, so wait until the size has stopped changing.
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, RESIZE_DEBOUNCE_MS);
  });
  resizeObserver.observe(el.hero);

  const intersectionObserver = new IntersectionObserver((entries) => {
    const latest = entries[entries.length - 1];
    if (!latest) return;
    onScreen = latest.isIntersecting;
    wake();
  });
  intersectionObserver.observe(el.hero);

  document.addEventListener(
    "visibilitychange",
    () => {
      tabVisible = document.visibilityState === "visible";
      wake();
    },
    { signal },
  );
  reducedMotion.addEventListener("change", updateRunning, { signal });
  watchPixelRatio();
  wake();

  return {
    setMode(mode) {
      if (PALETTES[mode] === target) return;
      target = PALETTES[mode];
      // While running, the palette blends as the animation plays. While
      // paused, the whole canvas is out of date, so repaint it.
      if (!running) startRepaint();
      wake();
    },
    setUserPaused(paused) {
      userPaused = paused;
      updateRunning();
    },
    floatLantern() {
      const { sceneW: SW, sceneH: SH, horizon: hy } = view;
      launchLantern(SW * (0.05 + Math.random() * 0.2), hy + (SH - hy) * (0.2 + Math.random() * 0.55));
    },
    lanternAt(clientX, clientY) {
      const rect = el.hero.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      // Page coordinates to scene pixels.
      const sx = ((clientX - rect.left) / rect.width) * view.sceneW;
      const sy = ((clientY - rect.top) / rect.height) * view.sceneH;
      if (sy > view.horizon + 2) launchLantern(sx, sy);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(rafId);
      rafId = 0;
      clearTimeout(resizeTimer);
      listeners.abort();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
    },
  };
}
