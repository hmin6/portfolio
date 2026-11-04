# ADR-006: Imperative painter engine behind a thin React component
Date: 2026-11-03
Status: Accepted

## Context
The painted hero (ADR-003, ADR-004) redraws two canvases about 60 times a second, keeps hundreds of moving parts (strokes, lanterns, palette blending, an adaptive stroke budget), and listens to resize, visibility, and media-query events. It has to live inside a Next.js App Router page with Cache Components turned on. That means React's `<Activity>` hides the page on navigation instead of unmounting it, effects are cleaned up and run again when the page is hidden and shown, and Strict Mode and Fast Refresh in development run the same cycle.

## Options considered
- **State in React**: keep the scene state in `useState` or `useReducer` and draw in an effect. Familiar, but every frame would re-render the component, and the drawing code would be tied to React's render cycle.
- **Canvas library with React bindings** (for example React Three Fiber, or a 2D scene-graph library): handles the loop and cleanup for us, but adds a large dependency for what is a hand-written Canvas 2D renderer, and doesn't match ADR-004's "fewer dependencies at launch."
- **Imperative engine behind a thin component**: the renderer is plain TypeScript (`createPainter`) that owns the canvases, the frame loop, and every listener and observer, and returns a small handle (`setMode`, `setUserPaused`, `floatLantern`, `lanternAt`, `destroy`). `PaintedHero.tsx` creates it in one effect, destroys it in that effect's cleanup, and passes button state to it.

## Decision
Use an imperative engine behind a thin React component. React holds only what the buttons display (mode and the visitor's pause choice). Everything per-frame stays in the engine. Data flows one way, from React to the engine. The engine reads `prefers-reduced-motion` itself so it is correct from the first frame, before React has hydrated.

## Consequences
- Easier: no re-renders while animating; the renderer can be read, tested, and later swapped for a WebGL version (ADR-004) without touching React; the drawing modules don't import React and could run anywhere a canvas exists.
- Easier: teardown is one function. `destroy()` cancels the frame, removes every listener through one `AbortController`, and disconnects the observers, so hide/show, Strict Mode, and Fast Refresh never leave a second loop running.
- Harder: two places hold related state (React for the buttons, the engine for drawing), so changes must go through the handle; the engine must never be the one to change the mode.
- Harder: nothing in the engine runs on the server, so all browser APIs (canvas, `matchMedia`, observers) must be created inside `createPainter`, never at module load.
