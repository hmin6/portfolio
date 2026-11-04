# ADR-008: Still frames painted off screen, not a pre-rendered image
Date: 2026-11-04
Status: Accepted

## Context
Visitors who prefer reduced motion, and anyone who presses Pause motion, should never see the hero painting fill in or move. They should see a finished, still painting. Before this change, whenever the paused canvas wasn't finished (first load with reduced motion, a mode change, a resize or phone rotation, a pause during the opening reveal), the engine repainted it on the visible canvas over 110 frames. On an emulated phone that was 3.5 s of visible filling in, and 4.9 s at 4× CPU slowdown (about 150–190k `stroke()` calls).

The painting is generated in the browser from code (ADR-003), with random brushstrokes, randomly seeded lanterns, and a scene that's stretched to the hero's shape at every screen size.

## Options considered
- **Pre-rendered still image** (for example a WebP in `public/`), shown before JavaScript loads and as a fallback, with the canvas taking over afterward.
  - Page weight: brushstroke texture compresses poorly, so expect roughly 60–200 KB for each size, plus a portrait version, because the layout changes on portrait screens (the gondola moves up). Every visitor would download it, including those who see the live painting.
  - Staying in sync: every palette, scene, or stroke change would need a re-capture. #5 alone changed the Night walls, roof rims, and gondola. A stale image would quietly show an older painting.
  - Mismatch at handoff: strokes and lantern positions are random, and `object-cover` crops while the canvas stretches the scene, so the horizon and buildings would shift. The visitor would see the picture jump when the canvas takes over. For a reduced-motion visitor, that's a worse change than a single swap.
  - As a fallback: if the canvas fails (a 2D context is almost always available), the hero is the dark `deep` background with text that already passes contrast (ADR-007). It doesn't need an image to be usable.
- **Paint the still on the visible canvas in one long task**: no intermediate frames, but the page would freeze for 0.2–1 s or more on a slow phone, including taps on the hero's own buttons.
- **Paint the still off screen, in short chunks on the main thread, and swap it in when complete.**
- **Paint the still in a Web Worker with `OffscreenCanvas`**: keeps the main thread completely free, but the sprites, theme colors, and scene drawing would have to move into or be passed to a worker, and the worker would need its own bundle. That's a lot of new structure for work that already fits in small chunks.

## Decision
Paint stills off screen in time-sliced chunks on the main thread (`src/components/painter/still.ts`), and swap each one onto the visible canvas in a single step, together with its light layer.

- The still is painted on a canvas that's never added to the page. Its ground is the hidden scene, smoothly stretched to full size, so the few pixels every stroke misses (strokes shrink on edges) show the scene's own color instead of flat underpaint. Over that go one large-stroke layer, one medium layer, and three finished-size layers. The stroke count comes from canvas area and stroke size, not device speed, so the still looks the same on every device.
- Each chunk paints for about 8 ms, then yields with `scheduler.yield()`, or a `MessageChannel` message where that isn't supported. Input and rendering continue between chunks.
- A newer still (another mode change or resize) cancels the one in progress, and so does resuming motion.
- Until the still is ready, the visible canvas holds whatever it showed: the dark background on first load, the stretched old painting after a resize, or the previous mode.
- Pausing a finished painting just stops. The 0.25 s catch-up from #4 is gone; screenshots showed the lantern glows still line up with the painted lanterns.
- A lantern added while paused is repainted in its small box in one go, in the same task as the click. If a still is being painted, the lantern waits and is added right after the swap.
- No pre-rendered image ships.

Measured in headless Edge (`npm run measure:hero -- --still`): the still appears about 0.24 s after navigation on desktop and 0.31 s on a phone, and 0.71 s on a phone at 4× CPU slowdown. No stroke lands on the visible canvas, and no long task comes from painting the still.

## Consequences
- Easier: paused visitors see at most one change per event (navy to painting, old mode to new, stretched to sharp), never a canvas filling in. The frame loop never runs while paused.
- Easier: no image to regenerate when the painting changes, and no extra bytes for anyone.
- Harder: on first load with reduced motion the hero is plain navy for about 0.1–0.6 s after first paint before the still appears (longer on slow devices). If testing on real phones shows that gap is noticeable, a follow-up can add a CSS gradient behind the canvas in the Night sky, horizon, and water colors: zero bytes, and close enough in color that the swap reads as detail arriving rather than a jump.
- Harder: the chunks still share the main thread. `scheduler.yield()` resumes ahead of other ordinary tasks, so timers and network callbacks can wait until the still is done (well under a second, measured). Moving the work into a worker with `OffscreenCanvas` is the later step if that ever matters, for example if a WebGL version (ADR-004) makes each still more expensive.
- Harder: a mode change while paused shows the new mode's buttons and text scrim about 0.1–0.2 s before the new painting swaps in.
