"use client";

import { useRef } from "react";
import { isMotionPaused } from "../motion";

/*
 * The pluck: a damped oscillation of the string's amplitude. scaleY flips
 * and stretches the wave around its center line, which is how a plucked
 * string's main vibration moves: out one way, back through rest, out the
 * other way, a little less each time.
 *
 *   scaleY(t) = 1 + A · e^(−t/τ) · sin(ωt)
 *
 * It starts at rest (sin 0 = 0), swings out to about 3× the resting wave,
 * and by the end is within 2% of rest, so the last keyframe can land exactly
 * on 1 without a visible jump. Computed once, as keyframes for the Web
 * Animations API.
 */
const PLUCK_MS = 900;
const AMPLITUDE = 2.2;
/** Swings per second. Slow enough to read as a vibration, not a flicker. */
const FREQUENCY = 5;
/** Time for the swing to shrink to about 37% (1/e). */
const DECAY_S = 0.22;
const STEPS = 36;
const PLUCK_KEYFRAMES: Keyframe[] = Array.from({ length: STEPS + 1 }, (_, i) => {
  const t = (i / STEPS) * (PLUCK_MS / 1000);
  const scale = i === STEPS ? 1 : 1 + AMPLITUDE * Math.exp(-t / DECAY_S) * Math.sin(2 * Math.PI * FREQUENCY * t);
  return { transform: `scaleY(${scale.toFixed(3)})` };
});

/**
 * A thin brass line between sections, slightly wavy like a guitar string at
 * rest. Hovering it (or tapping it on a touch screen) plucks it: it
 * vibrates briefly, then settles.
 *
 * Decorative only: hidden from screen readers and not focusable. It doesn't
 * move with prefers-reduced-motion or while Pause motion is on (motion.ts).
 */
export default function StringDivider() {
  const pathRef = useRef<SVGPathElement>(null);
  const pluckRef = useRef<Animation | null>(null);

  function pluck() {
    const path = pathRef.current;
    if (!path || isMotionPaused()) return;
    // A string that's still ringing isn't plucked again.
    if (pluckRef.current?.playState === "running") return;
    // The Web Animations API rather than a CSS :hover animation: a :hover
    // animation stops and snaps back as soon as the pointer leaves, but this
    // one always finishes settling.
    pluckRef.current = path.animate(PLUCK_KEYFRAMES, { duration: PLUCK_MS });
  }

  return (
    // 24px tall so the 1px line is easy to hover; the line sits in the middle.
    <div aria-hidden="true" onPointerEnter={pluck} className="flex h-6 items-center px-[clamp(16px,4vw,48px)]">
      {/*
        The viewBox is 1000 wide and 12 tall; preserveAspectRatio="none"
        stretches it to any width. vector-effect keeps the stroke 1px wide
        however it's stretched or scaled. The path is a gentle wave (about
        ±1.5px): each `T` continues the curve with the previous control
        point mirrored, alternating crests and troughs. transform-box makes
        scaleY pivot on the wave's own center line. overflow-visible lets
        the plucked wave swing past the 12px box.
      */}
      <svg
        viewBox="0 0 1000 12"
        preserveAspectRatio="none"
        focusable="false"
        className="h-3 w-full overflow-visible"
      >
        <path
          ref={pathRef}
          d="M0 6 Q125 3 250 6 T500 6 T750 6 T1000 6"
          fill="none"
          stroke="var(--color-brass)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
          className="[transform-box:fill-box] origin-center"
        />
      </svg>
    </div>
  );
}
