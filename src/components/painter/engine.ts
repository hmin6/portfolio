import { rgba } from "./color";
import { addLantern, seedLanterns, updateLanterns, type Lantern } from "./lanterns";
import { createLayout, createViewport, type AuroraBand, type Viewport } from "./layout";
import { drawLights } from "./lights";
import { clonePalette, lerpPalette, PALETTES, readThemeColors, type ModeId } from "./palettes";
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

/** Frames painted after motion stops, so strokes finish covering the scene (~2 s at 60 fps). */
const SETTLE_FRAMES = 110;
/** Opening frames that paint extra, larger strokes to cover the blank canvas quickly. */
const REVEAL_FRAMES = 90;
const RESIZE_DEBOUNCE_MS = 150;

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
  let running = !(userPaused ?? reducedMotion.matches);

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
  /** Frames since the last resize, for the opening reveal. */
  let frames = 0;
  /** Frames painted since motion stopped or something changed. */
  let settle = 0;
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
    settle = 0;
    if (lanterns.length === 0) lanterns = seedLanterns(view);
    wake();
  }

  /*
   * The frame loop only runs while there is something to draw. When motion
   * is paused and the painting has settled, or the hero is off screen, or
   * the tab is hidden, it stops scheduling frames entirely, and wake()
   * restarts it when something changes.
   */
  function canDraw(): boolean {
    return onScreen && tabVisible;
  }
  function isAnimating(): boolean {
    return running && canDraw();
  }
  function isSettling(): boolean {
    return canDraw() && settle < SETTLE_FRAMES;
  }

  /** Restarts the loop if it is idle and there is something to draw. */
  function wake(): void {
    if (destroyed || rafId !== 0) return;
    if (!isAnimating() && !isSettling()) return;
    // The time spent idle shouldn't count as animation time.
    lastTime = null;
    rafId = requestAnimationFrame(frame);
  }

  function frame(now: number): void {
    rafId = 0;
    if (destroyed) return;
    // Seconds since the previous frame, from requestAnimationFrame's own
    // timestamps only. (Mixing in performance.now() breaks this: a frame's
    // timestamp is when the frame *began*, which can be earlier than the
    // end of the previous frame's work, so dt would come out at or below 0.)
    // Capped at 50 ms so one slow frame doesn't make everything jump.
    const dt = lastTime === null ? 0 : Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    const animate = isAnimating();
    if (!animate && !isSettling()) return;

    if (animate) {
      t += dt;
      lanterns = updateLanterns(lanterns, view, dt, palette.windowLight > 0.3);
      // Frame-rate independent easing: each frame keeps 0.25^dt of the
      // remaining distance, so after one second 25% remains (75% done),
      // whether that second had 30 frames or 120.
      lerpPalette(palette, target, 1 - Math.pow(0.25, dt));
    } else {
      // Paused: no clock to follow, so ease a fixed 20% per settle frame.
      lerpPalette(palette, target, 0.2);
    }

    drawScene({ ctx: ctx.scene, view, layout, palette, sprites, theme, lanterns, t, band });
    const pixels = ctx.scene.getImageData(0, 0, view.sceneW, view.sceneH).data;

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
    if (!animate) settle++;
    // Keep going without wake(), so lastTime carries over to the next frame.
    if (isAnimating() || isSettling()) rafId = requestAnimationFrame(frame);
  }

  /** Recomputes `running` from the visitor's choice and the media query. */
  function updateRunning(): void {
    const next = !(userPaused ?? reducedMotion.matches);
    if (next === running) return;
    running = next;
    settle = 0;
    wake();
  }

  function launchLantern(x: number, y: number): void {
    addLantern(lanterns, view, x, y);
    settle = 0;
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
      settle = 0;
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
