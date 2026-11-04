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

  return (
    <section
      ref={heroRef}
      aria-labelledby={titleId}
      onClick={handleHeroClick}
      className="relative h-svh max-h-[1100px] min-h-[600px] overflow-hidden bg-deep text-starlight"
    >
      <canvas ref={paintRef} role="img" aria-label={description} className="absolute inset-0 block size-full" />
      <canvas
        ref={lightsRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 block size-full mix-blend-screen"
      />
      {/* The engine sets this div's background image; React must not set its style. */}
      <div ref={weaveRef} aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-50 mix-blend-overlay" />
      {/* Vignette, then a scrim that darkens the bottom so the intro text stays readable. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-radial-[at_50%_42%] from-transparent from-55% to-deep/50"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[58%] bg-linear-to-t from-deep/80 to-transparent"
      />

      <div className="absolute inset-x-[clamp(16px,4vw,48px)] top-[clamp(16px,3vh,28px)] flex flex-wrap justify-end gap-2.5">
        <div
          role="group"
          aria-label="Time of day"
          className={`flex rounded-full p-1 ${pillEdge}`}
        >
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={m.id === mode}
              onClick={() => setMode(m.id)}
              className={segmentStyle}
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

      <div className="absolute bottom-[clamp(36px,8vh,80px)] left-[clamp(20px,5vw,64px)] flex max-w-[min(620px,calc(100%-40px))] flex-col gap-[18px]">
        {children}
      </div>
    </section>
  );
}
