# ADR-009: Site header above the painting, and Pause motion as a site-wide setting
Date: 2026-11-04
Status: Accepted

## Context
Every page needs a header with my name and the main nav (#7). The home page starts with the painted hero, whose own controls (time of day, Float a lantern, Pause motion) already sit at the top of the painting: top right on desktop, and two full-width rows on phones. Text over the painting has to pass the contrast bar in ADR-007 in every mode, and Day's sky is bright.

The shared layout also adds string dividers that vibrate when plucked. Until now, Pause motion was React state inside the hero, so nothing outside the hero could follow it.

## Options considered
**Where the header goes**
- **Over the painting** (transparent, on top of the hero): shows more painting, but crowds the hero's controls. On phones it would mean a third row of pills over the sky. The nav's text and focus ring would need their own scrim and a new round of ADR-007 measurements in every mode.
- **Above the painting** (a solid `night` bar in normal flow): contrast is guaranteed (starlight on night is 15.9:1), the hero's controls don't change, and the bar frames the painting like a mat. It costs 56px of painting on the first screen.
- **Moving the hero's controls into the header**: one row of controls, but they belong to the painting, not to navigation, and they'd be on every page.

**How it behaves**
- **Sticky**: always reachable, but on a 568px-tall phone it would permanently cover a tenth of the screen. The page is one screen plus a footer today.
- **Scrolls away** with the page: simple, nothing covers the content.
- **Links on phones**: a Menu button always, or links inline whenever they fit, with the Menu only as a fallback.

**Pause motion**
- Keep it hero-only, and give the dividers just prefers-reduced-motion.
- Make it site-wide: one shared value that the hero, the painter engine, and the dividers all read.
- Site-wide and saved (`localStorage`), so it survives a reload.

## Decision
- **Header**:
  - It's a solid `night` bar, 56px tall (`--header-h`), above the hero. It isn't sticky.
  - The hero fills the rest of the first screen, `min(100svh − 56px, 1100px)`, so the first screen still ends where the hero does.
  - The hero's bottom padding fades from the painting into the page's `night` background, so it no longer ends on a hard edge.
- **Nav**:
  - It's built from one list in `src/app/site.ts`, which only includes sections that exist. Today that's Contact; Work (#8) and About (#9) are added with their sections.
  - The links show inline whenever they fit on one line, phones included.
  - A `ResizeObserver` compares the width the links need with the width available. When they don't fit, a Menu button (the disclosure pattern) replaces them. Escape, clicking outside, or tabbing out closes it.
- **Pause motion is site-wide**:
  - The visitor's choice lives in `src/components/motion.ts`, read with `useSyncExternalStore`.
  - The hero's button, the painter engine, and the string dividers share one rule (`resolvePaused`): the visitor's choice wins, otherwise prefers-reduced-motion decides.
  - The choice lasts for the session, including client-side navigation, but not a reload.

## Consequences
- Easier: the header never needs contrast measuring against the painting. Its links and focus ring sit on `night`.
- Easier: any future motion (for example a hover effect in the Collection) can call `isMotionPaused()` and follow the same setting.
- Easier: the nav doesn't need a design change when #8 and #9 add links. If they stop fitting at some width, the Menu appears there by itself (tested with five links: inline on desktop, Menu at 412px and 320px).
- Harder: the hero is 56px shorter, and the painting is laid out by the hero's height (the horizon is at 53%), so the text block sits closer to the bright horizon. On a 320×568 phone at Night the heading's lightest 1% fell from about 6.2:1 to 3.8:1, below the 4.5:1 bar. The Night text scrim went from 50% to 60% to fix it, the same as Golden hour (see the update in ADR-007).
- Harder: before hydration the nav always renders inline. If a future link list didn't fit, the header would clip it sideways (`overflow-x-clip`) until the fit check runs, a moment after load. It never scrolls the page sideways.
- Harder: Pause motion resets on reload. Saving it would bring back the hydration gap from #6: the server can't know the saved value, so the button would show the wrong state until React hydrates. That's left for a follow-up if visitors ask for it.
