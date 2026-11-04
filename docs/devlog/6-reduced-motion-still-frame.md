# #6 Add a reduced-motion still frame for the hero
Date: 2026-11-04
PR: #25

## What I did
Made the hero hold still for anyone who prefers reduced motion or presses Pause motion:
- The painting never fills in on screen. When the paused canvas needs repainting, a finished still is painted off screen and swapped in at once. That covers the first load, a mode change, a resize or rotation, a pause during the opening reveal, and the OS setting turning on.
- Pausing a finished painting now stops immediately, with no 0.25 s catch-up.
- A lantern added while paused appears finished, in the same moment as the click.
- The Pause motion button looks pressed from the first paint for reduced-motion visitors, before React hydrates.

I also added a `--still` option to `npm run measure:hero`, and ADR-008 on why the still is painted off screen instead of shipping a pre-rendered image.

## Why
Testing #20 on my phone showed that with Pause motion on, rotating or changing the mode ran a full repaint you could watch for about 2 seconds before it froze. A reduced-motion visitor saw the same thing on first load. Measured on an emulated phone, that was 3.5 s of the canvas filling in, and 4.9 s with the CPU slowed 4×. That's exactly the motion those visitors asked not to see.

## How it works
- **Painting off screen.** `still.ts` creates a canvas that's never added to the page and paints the whole still on it. Only when it's complete does the engine draw it onto the visible canvas, with one `drawImage`, and redraw the light layer in the same task, so both change in the same frame.
- **Not freezing the page.** About 78,000 stroke calls on a phone would block the main thread for a noticeable moment. Instead, the still is painted in chunks of about 8 ms. Between chunks, `scheduler.yield()` lets the browser handle taps and draw a frame. Where `scheduler.yield()` isn't available, a `MessageChannel` message does the same job; `setTimeout(0)` would be clamped to 4 ms after a few calls. On a phone at 4× slowdown the still is ready about 0.7 s after navigation, and no long task comes from painting it.
- **Layers, like a painter.** The ground is the small hidden scene, stretched smoothly to full size. Over it go one layer of large strokes, one of medium strokes, then three layers of normal-size strokes. The stroke count comes from the canvas area and stroke size, so the still looks the same on a fast or slow device.
- **Cancelling.** Each still has an `AbortController`. A newer still (another mode change or resize), resuming motion, or unmounting aborts it, and the painting loop checks the signal after every chunk.
- **Pause button before hydration.** The server doesn't know about reduced motion, but CSS does. While the visitor hasn't chosen, the button has a `data-follows-system` attribute. With Tailwind's `motion-reduce:` variant, that gives it the pressed look from the first paint.
- **Measuring.** `--still` wraps `stroke()` and `drawImage()` to count strokes on visible canvases separately from off-screen ones, and to spot each swap. It also hashes the canvases every 50 ms to count how many distinct states a visitor could see.

## Problems I hit
- **Specks of brown in the still.** The first version started from the flat underpaint color, like the live loop. Strokes shrink on edges such as rooftops and window frames, so a few pixels there were missed by every stroke, and showed up as brown specks (about 1% of the canvas). The live loop covers them over many seconds; a still gets one go. Using the stretched scene as the ground fixed it, since a missed pixel now shows the right color, and it needed one large-stroke layer fewer.
- **A canvas that changed without being drawn on.** My check said the light layer changed while paused, with no draw calls at all. Chrome moves a canvas out of GPU memory after `getImageData` reads it, and the faint, semi-transparent glows can then read back, and even composite, a step differently. Screenshots without any readback were pixel-identical. The fix was in the test, not the site: take screenshots before reading the canvases, and do one throwaway read first.
- **The sampler that never ran.** The 50 ms sampler never ran while the still was being painted, because `scheduler.yield()` continues the still ahead of ordinary timers. Input and rendering still get their turn, but timers wait. That's fine for a task this short, but it meant the stroke counts, not the sampler, were what proved no intermediate frame ever reached the screen.
- **Ruling out the long tasks.** Each first load showed one long task. Comparing loads with reduced motion on and off showed it happens either way: it's hydration and engine startup, not the still.

## What I learned
- **Draw off screen, then swap.** Instead of painting the still where visitors can see
  it fill in, the engine paints it on a canvas that's never on the page and copies the
  finished result over in a single frame. It's the same idea as double buffering in
  games: draw the next frame on a hidden buffer, then show it all at once, so nobody
  sees a half-finished image.
- **Long work has to be broken up.** Painting about 60–78k strokes at once would freeze
  the page, so the render runs in chunks of about 8 ms and yields to the browser between
  them with `scheduler.yield()`. Clicks and taps stay responsive, and no chunk comes near
  the 50 ms long-task line.
- **Fast can break assumptions in tests.** `scheduler.yield()` let the still finish
  sooner than the test expected, so the test's own timing had to be fixed. The test is
  part of the system, and a speed-up can surface bugs in it.
- **Edges need a sensible fallback.** Strokes shrink near edges, which left about 1% of
  pixels showing brown underpaint. Starting the still from the hidden scene stretched to
  full size means any pixel the strokes miss still shows the right color.
- **Measuring can change what you measure.** Reading pixels back from a canvas can
  change how Chrome stores it, so early reads didn't match later ones. Comparing
  back-to-back reads showed the difference came from the measurement, not the painting.
- **CSS can fix what React hasn't reached yet.** Before hydration, React hasn't read the
  reduced-motion setting, so the Pause button would look unpressed. A server-rendered
  attribute plus Tailwind's `motion-reduce:` variant makes it look right from the first
  paint, because CSS doesn't wait for JavaScript. Screen readers still hear the old state
  until hydration, which is documented in the PR.
