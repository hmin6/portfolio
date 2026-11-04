"use client";

import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPainter, REDUCED_MOTION_QUERY, resolvePaused, type Painter } from "./engine";
import { MODES, type ModeId } from "./palettes";

/*
 * prefers-reduced-motion as React state, for the Pause button's pressed
 * look. useSyncExternalStore subscribes to something outside React (here a
 * media query). On the server there's no media query, so getServerSnapshot
 * says "no preference"; after hydration React re-reads the real value
 * without a hydration error. The engine reads the media query itself, so
 * this value never controls the animation.
 */
function subscribeReducedMotion(onChange: () => void): () => void {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
function getReducedMotion(): boolean {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}
function getServerReducedMotion(): boolean {
  return false;
}

/*
 * Pill buttons over the painting. `aria-pressed:` styles apply only when
 * aria-pressed="true", so the visible state always matches what screen
 * readers announce.
 *
 * The pill edge has two tones for the same reason as the focus ring in
 * globals.css: a light border shows against the dark Night sky, and a 1px
 * dark ring (`ring-1`, a box-shadow) outside it shows against the bright
 * Day sky. `focus-visible:shadow-focus` keeps the focus ring's dark bands,
 * which the ring utility would otherwise replace.
 *
 * Against a mid-tone part of the painting, neither tone reaches 3:1 unless
 * the two are at least 9:1 apart, so the border is 80% starlight (it blends
 * with the dark fill behind it) and the ring is 85% deep.
 */
const pressedStyle = "aria-pressed:bg-starlight aria-pressed:text-night";
const pillEdge = "border border-starlight/80 bg-deep/70 ring-1 ring-deep/85 backdrop-blur-md";
const chipStyle = `min-h-12 cursor-pointer rounded-full px-3 text-sm font-medium text-starlight focus-visible:shadow-focus sm:px-[18px] ${pillEdge} ${pressedStyle}`;
const segmentStyle = `min-h-11 min-w-11 cursor-pointer rounded-full px-3 text-sm whitespace-nowrap font-medium text-starlight sm:px-3.5 ${pressedStyle}`;

interface PaintedHeroProps {
  /** id of the heading passed in `children`, which names this section. */
  titleId: string;
  /** Heading, intro, and links. Rendered on the server and passed in. */
  children: ReactNode;
}

/**
 * The homepage hero: a live, brush-painted canal (see engine.ts) with
 * controls for time of day, lanterns, and motion.
 */
export default function PaintedHero({ titleId, children }: PaintedHeroProps) {
  const heroRef = useRef<HTMLElement>(null);
  const paintRef = useRef<HTMLCanvasElement>(null);
  const lightsRef = useRef<HTMLCanvasElement>(null);
  const weaveRef = useRef<HTMLDivElement>(null);
  const painterRef = useRef<Painter | null>(null);

  const [mode, setMode] = useState<ModeId>("night");
  /** The visitor's explicit choice; null until they press Pause motion. */
  const [userPaused, setUserPaused] = useState<boolean | null>(null);
  const prefersReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotion,
    getServerReducedMotion,
  );
  // Same rule the engine uses, so the button always matches the painting.
  const paused = resolvePaused(userPaused, prefersReducedMotion);

  // An Effect Event reads the latest mode and pause choice when the effect
  // below runs, without making them dependencies. Otherwise the engine
  // would be torn down and rebuilt on every button press.
  const getStartOptions = useEffectEvent(() => ({ mode, userPaused }));

  // Create the engine on mount; destroy it on unmount. This also runs when
  // Next hides the page during navigation (Cache Components uses React's
  // <Activity>, which runs effect cleanup on hide and the effect again on
  // show), in Strict Mode's mount-unmount-mount check in development, and
  // on Fast Refresh. destroy() leaves nothing running each time.
  useEffect(() => {
    const hero = heroRef.current;
    const paint = paintRef.current;
    const lights = lightsRef.current;
    const weave = weaveRef.current;
    if (!hero || !paint || !lights || !weave) return;

    const painter = createPainter({ hero, paint, lights, weave }, getStartOptions());
    painterRef.current = painter;
    return () => {
      painter?.destroy();
      painterRef.current = null;
    };
  }, []);

  // Pass later changes to the engine. These are declared after the effect
  // above, so on mount they run after the engine exists.
  useEffect(() => {
    painterRef.current?.setMode(mode);
  }, [mode]);
  useEffect(() => {
    painterRef.current?.setUserPaused(userPaused);
  }, [userPaused]);

  function handleHeroClick(event: MouseEvent<HTMLElement>) {
    // Clicks on buttons and links do their own thing.
    if (event.target instanceof Element && event.target.closest("button, a")) return;
    painterRef.current?.lanternAt(event.clientX, event.clientY);
  }

  const description = MODES.find((m) => m.id === mode)?.description ?? "";

  /*
   * Layout: a flex column, controls at the top and text at the bottom, with
   * the canvases and overlays absolutely positioned behind them. The column
   * fills the screen (up to 1100px tall), and because the controls and text
   * are in normal flow, they can never overlap: on a short screen, like a
   * phone in landscape, the hero grows taller instead.
   *
   * The controls and text need `relative` to paint above the absolutely
   * positioned canvases. `data-mode` lets the text scrim change with the
   * mode (see below).
   */
  return (
    <section
      ref={heroRef}
      aria-labelledby={titleId}
      data-mode={mode}
      onClick={handleHeroClick}
      className="group/hero relative flex min-h-[min(100svh,1100px)] flex-col justify-between gap-8 overflow-hidden bg-deep px-[clamp(16px,4vw,48px)] pt-[clamp(16px,3vh,28px)] pb-[clamp(36px,8vh,80px)] text-starlight"
    >
      <canvas ref={paintRef} role="img" aria-label={description} className="absolute inset-0 block size-full" />
      <canvas
        ref={lightsRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 block size-full mix-blend-screen"
      />
      {/* The engine sets this div's background image; React must not set its style. */}
      <div ref={weaveRef} aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-50 mix-blend-overlay" />
      {/* Vignette, then a gradient that darkens the bottom of the painting. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-radial-[at_50%_42%] from-transparent from-55% to-deep/50"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[58%] bg-linear-to-t from-deep/80 to-transparent"
      />

      {/*
        Phones: the mode group on its own row at full width, then the two
        chips side by side at half width each. From `sm` up: one row,
        aligned right, as before. The mode buttons use `flex-auto` (start
        from the label's width, then share the spare space), not `flex-1`:
        with `min-w-11` set, `flex-1` lets "Golden hour" shrink below its
        label and slide under the next button at 320px.

        `z-10` keeps the controls above the text block, which comes later in
        the page. On a narrow phone the text block is tall, and its scrim
        reaches up behind the controls; without this it would paint over
        them and dim their borders.
      */}
      <div className="relative z-10 grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap sm:justify-end">
        <div
          role="group"
          aria-label="Time of day"
          className={`col-span-2 flex rounded-full p-1 ${pillEdge}`}
        >
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={m.id === mode}
              onClick={() => setMode(m.id)}
              className={`flex-auto sm:flex-none ${segmentStyle}`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => painterRef.current?.floatLantern()} className={chipStyle}>
          Float a lantern
        </button>
        {/* The label stays the same; aria-pressed (and the pressed style) shows the state. */}
        <button
          type="button"
          aria-pressed={paused}
          onClick={() => setUserPaused(!paused)}
          className={chipStyle}
        >
          Pause motion
        </button>
      </div>

      {/*
        The text block. `isolate` starts a new stacking context, so the
        scrim's -z-10 puts it behind the text but still above the painting.
        The text shadow covers brief bright spots (a lantern or sun glint
        drifting behind a letter) that the scrim alone would let through.
        Links are left out: the GitHub button has dark text on its own fill.
      */}
      <div className="relative isolate flex max-w-[620px] flex-col gap-[18px] sm:ml-[clamp(4px,1vw,16px)] [text-shadow:0_1px_2px_rgb(5_8_26/0.6),0_0_16px_rgb(5_8_26/0.45)] [&_a]:[text-shadow:none]">
        {/*
          Text scrim: an ellipse of `deep`, much larger than the text block:
          40% of its width out on each side, and 144px above and below.
          (144px is about 60% of the block's height on desktop; a percentage
          would cover the whole painting on a phone, where the block is much
          taller.) With `closest-side` the ellipse touches the element's
          edges. It stays fully dark out to 55% of the way to the edge, which
          covers all of the text, then fades out over the rest, so there's no
          visible edge. It belongs to the text block, so it follows the text
          on any screen size. It is strongest in Day, where the painting is
          brightest, and fades between modes over about the time the painting
          takes to blend. ADR-007 has the measurements behind these values.
        */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-x-[40%] -inset-y-36 -z-10 bg-[radial-gradient(closest-side,var(--color-deep)_55%,rgb(5_8_26/0.5)_78%,transparent)] opacity-50 transition-opacity duration-1000 group-data-[mode=day]/hero:opacity-80 group-data-[mode=golden]/hero:opacity-60 motion-reduce:transition-none"
        />
        {children}
      </div>
    </section>
  );
}
