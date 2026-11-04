# ADR-007: Keeping text readable over a live painting
Date: 2026-11-03
Status: Accepted

## Context
The hero's heading, intro, and controls sit on top of the painted canal (ADR-003), and the painting is never the same twice: it moves, it changes with the mode (Night, Golden hour, Day), lanterns drift behind the text, and the layout changes with the screen size. A single text color can't be checked against one background color the way the design tokens were (devlog #3).

Measured on the version from #4, the text failed WCAG AA in many places. Contrast of the lightest 1% of pixels behind the text:

- Heading: as low as 1.36:1 (Day, 320px wide), 3.54:1 (Day, desktop), 2.62:1 (Day, phone in landscape).
- Intro: as low as 3.17:1 (Day, 320px wide).
- The aurora focus ring: 1.0 to 1.7:1 over the Day sky.
- Pill borders (starlight at 20%): about 1.3:1 in every mode, Night included.

The worst cases were on narrow phones, where the text sits in the middle of the screen near the bright horizon, above the full-width gradient that darkened the bottom of the hero.

## Pass bar
- **Text** (heading and intro): the lightest 1% of pixels behind every line of text must have at least 4.5:1 contrast with the text, in every mode, on a desktop (1440×900) and four phone sizes (412×892 and 892×412, the Galaxy S25 Ultra at its default resolution; 375×667; 320×568). The heading is large text, so AA only asks 3:1 of it; it is held to 4.5:1 anyway. The lightest 1% rather than the single lightest pixel, because a lantern or a highlight stroke can pass behind a letter for a moment; the single lightest pixel is still reported.
- **Pill text**: the same 4.5:1, measured against the pill's fill with whatever shows through it.
- **Focus ring and pill edges**: 3:1 against the painting next to them (WCAG 1.4.11, non-text contrast).

`scripts/measure-hero.mjs` (`npm run measure:hero`) measures all of these in a headless browser: it hides the text, screenshots what's behind it, and computes the contrast for every pixel under each line. It also Tabs through the controls with the painting paused and compares the focused and unfocused screenshots, so it measures the focus ring as actually drawn.

## Options considered
- **A darker full-width gradient** (what #4 had): simple, but it has to darken the whole bottom of the painting to reach the text, and on narrow phones the text sits above where the gradient is strong.
- **A panel behind the text** (a blurred, translucent card): the surest contrast, but it puts a box over the painting and hides more of it than needed.
- **Text shadow only**: barely changes the painting, but a shadow only darkens a few pixels around each letter. It can't fix a bright sky behind the whole heading (1.36:1).
- **Different text colors per mode**: dark text in Day, light text at night. It would change the brand look per mode, and mid-tones like the golden sky don't suit either.
- **A soft scrim attached to the text block, plus a light text shadow**: an ellipse of `deep` behind the text, much larger than the text block, fully dark over the text and fading out over a long distance so it has no visible edge. Because it is part of the text block, it follows the text at every screen size. Its strength changes with the mode, since the painting is much brighter in Day than at Night.

For the focus ring and pill edges, any single color fails somewhere: a light outline disappears over the Day sky, and a dark one disappears at Night.

## Decision
- **Text**: a scrim attached to the text block (`PaintedHero.tsx`): 50% in Night, 60% in Golden hour, 80% in Day. It reaches 40% of the block's width past each side, and 144px above and below. A light text shadow covers brief bright spots. A panel was kept as the fallback for any case that still failed, but none did.
- **Focus ring**: two colors, site-wide in `globals.css` (WCAG technique C40): an aurora outline between a 2px and a 1px dark band. Aurora against `deep` is about 15:1, so one of the two always has 3:1 against whatever is behind the ring.
- **Pill edges**: the same idea. A light border (80% starlight) with a 1px dark ring (85% deep) outside it. Against a mid-tone part of the painting neither tone reaches 3:1 unless the two are at least 9:1 apart, which is why the border had to go from 55% to 80%.

Results, lightest 1% of pixels (worst case anywhere):

| | Before | After |
|---|---|---|
| Heading | 1.36 | 5.58 |
| Intro | 3.17 | 8.84 |
| Pill text | 6.05 | 8.21 |
| Focus ring | 1.00 | 3.91 |
| Pill edges | 1.31 | 3.18 |

The single lightest pixel behind the heading is 4.34:1 (phone in landscape, Night), most likely a lantern's glow passing behind a letter. That is above the 3:1 AA bar for large text, and the text shadow covers it.

## Consequences
- Easier: the text is readable on every screen size and mode, and the measurement script makes that checkable after any change to the palettes, the layout, or the painting.
- Easier: the focus ring works on any background on any page, not just the hero.
- Harder: the scrim darkens the painting around the text, most visibly in Day. That part of the painting is less bright than the rest.
- Harder: the scrim has to stay under the controls. The text block comes after the controls in the page and starts its own stacking context, so on narrow phones, where the block is tall, its scrim reached up over the pills and dimmed their borders until the controls got `z-10`.
- Harder: any new text over the hero has to go inside the text block, or get its own measurement. Elements with their own `shadow-*` or `ring-*` classes need `focus-visible:shadow-focus` to keep the focus ring's dark bands.
- The numbers come from headless Edge with emulated devices. They still need a check on a real phone.
