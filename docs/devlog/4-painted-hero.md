# #4 Port the painted hero to TypeScript modules
Date: 2026-11-03
PR: #20

## What I did
Ported the brushstroke canal painting from the single-file prototype (`reference/painted-canal.html`) into typed modules under `src/components/painter/`, and made it the homepage hero in place of the temporary token preview. Added ADR-006 for the engine design, and opened #19 for a future "How this site is painted" page, since the prototype's "How it's painted" link had nowhere to go yet. Before starting, I merged #18 and turned off AI attribution in commits and PRs (`attribution` in `.claude/settings.json`).

## Why
The prototype proved the look, but it was one long script with globals, so it couldn't live inside a Next.js page. The hero needed to be split into pieces I can read and change one at a time. It also had to survive React's lifecycle (navigation, Strict Mode, hot reload) without leaking animation loops, and stay accessible: real buttons, pressed states, alt text, and reduced motion.

## How it works
- **Ten modules, each with one job:**
  - `palettes.ts`: the three modes and blending between them.
  - `layout.ts`: scene geometry, plus which region each scene pixel belongs to.
  - `scene.ts`: draws the hidden low-resolution scene.
  - `strokes.ts`: paints brushstrokes sampled from the hidden scene.
  - `lights.ts`: the glow layer.
  - `lanterns.ts`, `sprites.ts`, `color.ts`: lanterns, pre-drawn images, and color helpers.
  - `engine.ts`: the frame loop and everything that needs cleanup.
  - `PaintedHero.tsx`: the React component.
- **Engine outside React (ADR-006):** `createPainter()` is plain TypeScript that returns a small handle (`setMode`, `setUserPaused`, `floatLantern`, `lanternAt`, `destroy`). React only holds what the buttons show, so nothing re-renders 60 times a second.
- **Cleanup in one call:** every `addEventListener` gets the same `AbortController` signal, so `destroy()` removes them all with one `abort()`. It also cancels the pending frame and disconnects the `ResizeObserver` and `IntersectionObserver`. This matters because Cache Components hides pages with React's `<Activity>`, which runs effect cleanup on hide and the effect again on show.
- **The loop sleeps:** it stops scheduling frames when the hero is off screen, the tab is hidden, or motion is paused and the painting has settled. `wake()` restarts it.
- **Server-rendered text:** `page.tsx` stays a Server Component and passes the heading and intro into `PaintedHero` as `children`, so they arrive as HTML before any JavaScript.
- **Reduced motion from the first frame:** the engine reads `matchMedia('(prefers-reduced-motion: reduce)')` itself. React's copy (`useSyncExternalStore`) is only for the button's pressed look, because on the server it has to assume "no preference" until hydration.
- **Typed palettes without `any`:** the palette type is built from lists of its keys, so the blend function covers every key and TypeScript rejects a palette with a missing one.
- **Shared tokens:** the canvas reads aurora, teal, violet, magenta, and starlight from `globals.css`; per-mode scene colors stay in `palettes.ts`.
- **Pressed styles:** the buttons use Tailwind's `aria-pressed:` variant, so the visible pressed look can't drift from what screen readers announce.

## Problems I hit
- **Mode buttons did nothing to the painting.** Screenshots showed Golden hour and Day still painting the night scene, even though the buttons and alt text changed. The frame clock mixed two timers: it reset `lastTime` with `performance.now()` after each frame, but `requestAnimationFrame` timestamps mark when a frame *began*, which can be earlier. `dt` was floored to 0 every frame, so time froze and the palette blend factor `1 − 0.25^0` was 0. The aurora still seemed to move only because every frame paints new random strokes. Fixed by using frame timestamps only.
- **A design-token gap from #3.** Tailwind v4 only outputs CSS variables that some class uses, so `--color-violet` and `--color-magenta` would have been missing once the token preview page was deleted. Marking the theme block `@theme static` makes it output all of them, and the build CSS now has them.
- **Checking "only one loop runs" needed a way to see loops.** I drove headless Edge through the DevTools protocol and wrapped `requestAnimationFrame` to count distinct callbacks per second. Each painter has its own `frame` function, so that count is the number of live loops. It stayed at exactly 1 through Strict Mode and seven Fast Refresh rebuilds.
- **My first loop check attached to the wrong tab** (an Edge sync dialog), and a build piped into `Select-Object -First 12` was cut off early. Both were problems with the test setup, not the code, but they were confusing until I noticed.

## What I learned
- **Keep fast loops out of React state.** The painter redraws about 60 times a second.
  Storing per-frame data in React state would re-render the component every frame, so the
  engine is plain TypeScript and React only holds what the buttons display: the mode and
  whether motion is paused. React sends changes to the engine, never the other way.
- **Cleanup has to be safe to run more than once.** With `cacheComponents`, Next.js hides
  pages with React's `<Activity>` instead of unmounting them, which runs effect cleanup and
  setup again. Strict Mode and hot reload do the same. One `destroy()` that cancels the
  animation frame, disconnects observers, and removes every listener through a single
  `AbortController` makes repeated setup and teardown safe. Counting live loops after hot
  reloads proved only one ever runs.
- **Server rendering changes where browser code can live.** Client components still render
  to HTML on the server, so anything touching `window`, canvas, or `matchMedia` must run
  inside `useEffect`. The server doesn't know the visitor's reduced-motion setting, so the
  engine reads it directly when it starts. That way reduced-motion users never see a frame
  of animation before React catches up.
- **"It moves" isn't the same as "it works."** Mixing `performance.now()` with the
  animation frame's own timestamp made the time step zero, so the palette never blended
  into Golden hour or Day. New brushstrokes kept landing, so the painting looked alive.
  Checking every mode with screenshots caught what lint and build couldn't.
- **Accessible toggle buttons keep a fixed label.** A button that changes its label and
  also uses `aria-pressed` gets announced confusingly ("Play motion, pressed"). The pattern
  is a fixed label with `aria-pressed`, plus a visible pressed style driven by the same
  attribute so the look and the announcement can't disagree.
- **Tailwind only outputs variables it thinks are used.** After deleting the token preview,
  violet and magenta would have disappeared from the CSS. `@theme static` keeps every
  token available, which the canvas needs since it reads colors by variable name.
