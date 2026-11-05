# #7 Build the shared layout: header, nav, footer, string dividers
Date: 2026-11-04
PR: #26

## What I did
Built the layout every page shares:
- A header above the painting, with my name as the home link and the main nav.
- A "Skip to content" link, and the four landmarks: `header`, `nav`, `main`, `footer`.
- A footer with my email, GitHub, LinkedIn, a "built with" line, and the copyright.
- Brass string dividers that vibrate when you hover or tap them.
- A soft fade at the bottom of the hero, so the painting no longer ends on a hard edge.

I also made Pause motion a site-wide setting, so it stops the dividers as well as the painting. On top of that I added a `--page` option to `npm run measure:hero`, and wrote ADR-009.

## Why
Every page needs a way to get around and a way to reach me, and #8 and #9 need somewhere to plug their nav links into. Testing #20 on a tall monitor showed the hero stopping at 1100px with a hard line against the page.

## How it works
- **The header sits above the painting, not over it.** The hero's own controls already fill the top of the painting, so a header on top would have crowded them, especially on phones. It would also have needed its own contrast measurements over the bright Day sky. As a solid `night` bar, the header's contrast is 15.9:1 with no scrim, and the hero fills the rest of the first screen: `min(100svh − 56px, 1100px)`.
- **Links inline, Menu only as a fallback.** The nav is built from one list in `site.ts` that only includes sections that exist, so nothing links to a section that isn't built yet. A `ResizeObserver` adds up the widths the links need and compares that with the width the nav has. When they don't fit, a Menu button appears. The inline list stays in the page but invisible, so it can still be measured; `visibility: hidden` also takes it out of the Tab order and away from screen readers. The Menu closes with Escape, which returns focus to the button, and also when you click outside it or tab out.
- **A site-wide motion setting.** Pause motion used to be React state inside the hero. Now it lives in `motion.ts`, which components read with `useSyncExternalStore`, and the hero, the painter engine, and the dividers share one rule: the visitor's choice wins, otherwise `prefers-reduced-motion` decides.
- **The pluck.** The divider is an SVG wave. On hover, the Web Animations API animates its `scaleY` as a damped oscillation, 1 + A·e^(−t/τ)·sin(ωt): out one way, back through rest, out the other way, a little less each time. That's how a plucked string's main vibration moves. Unlike a CSS `:hover` animation, it keeps settling after the pointer leaves.
- **The fade.** A gradient from transparent to `night` fills the hero's bottom padding, below the text, so it never covers a letter. It's drawn above the text scrim, so the scrim can't leave a darker patch where the hero meets the page. The hero's last row of pixels now matches the page's background to within 1/255.
- **The footer year is a constant.** With Cache Components, the page is rendered once at build time, and `new Date()` during that render fails the build.

## Problems I hit
- **The header made the heading harder to read.** The painting is laid out by the hero's height (the horizon is at 53%), so making the hero 56px shorter moved the text closer to the bright aurora. On a 320px phone at Night, the heading's lightest 1% dropped from 6.67:1 to about 3.8:1, below the 4.5:1 bar, and it was the same on every re-run. Raising the Night scrim from 50% to 60% (the same as Golden hour) brought it back to 5.19:1.
- **The measurement script stopped at the skip link.** The focus-ring check Tabbed through the hero's controls and stopped at the first element outside the hero. Now the skip link and header come first, so it stopped immediately. It now Tabs past them until it reaches the hero.
- **A "change" that was the scrollbar.** The still-frame check from #6 sometimes said the screen changed while paused, with nothing drawn. Recording where it changed showed a 4px strip down the right edge of the emulated phone: the overlay scrollbar fading out after the page loads. The check now ignores that strip on phones.
- **Testing a Menu nobody can see yet.** With only one link, the Menu never appears. I tested it by temporarily giving the nav five links, building, and running the checks. On desktop they stayed inline; at 412px and 320px the Menu took over. Then I put the list back.
- **Contact only worked once.** When I tested it myself, clicking Contact a second time didn't scroll to the footer, and clicking my name afterwards sometimes scrolled to the footer instead of the top. The Next.js router only scrolls to a `#hash` when the hash changes, so a second click on `/#contact` did nothing. That ignored click also left `contact` saved as the router's pending scroll target, and the next navigation (my name, back to `/`) used it. Now a link to the page I'm already on scrolls there itself in `Link`'s `onNavigate` and adds the URL to history with `pushState`. The first version scrolled before pushing, which made Back land on the footer instead of the top: the browser saves an entry's scroll position at the moment the next entry is pushed. `npm run measure:hero -- --page` now clicks both links more than once and checks where the page lands.

## What I learned
- **Nothing around the hero is layout-only.** The painting is laid out from the hero's
  height, so adding a 56px header made the hero shorter and moved the bright aurora
  behind my name. On a 320px phone at Night, the heading dropped to 3.8:1. Raising the
  Night scrim from 50% to 60% brought it to 5.19:1. From now on, I re-run
  `npm run measure:hero` after any change that touches the hero's size or surroundings.
- **Responsive by content, not just breakpoints.** The nav measures whether its links
  fit with a `ResizeObserver` and only switches to a Menu button when they don't. Testing
  it with a temporary five-link list proved both states work before the nav actually
  needs the Menu.
- **Use the right accessibility pattern for the job.** A site nav menu is a disclosure:
  a button with `aria-expanded` and `aria-controls` that shows and hides links. ARIA's
  `role="menu"` is meant for app-style menus with different keyboard behavior. Escape
  closes the panel and returns focus to the button.
- **Shared settings belong in a shared store.** Pause motion used to live inside the hero
  component. Moving it into a small store read with `useSyncExternalStore` lets the
  dividers follow the same setting. It lasts for the session; saving it to
  `localStorage` would bring back the hydration gap from #6.
- **Animations can follow physics.** The divider's pluck is a damped oscillation,
  1 + A·e^(−t/τ)·sin(ωt), a simple model of a string's main vibration. It uses sin so it
  starts from the resting line instead of jumping. Using the Web
  Animations API instead of CSS `:hover` means the pluck finishes settling even after
  the pointer leaves.
- **Skip links need a focus target.** "Skip to content" links to `<main>` with
  `tabIndex={-1}`, so focus actually moves into the page, not just the scroll position.
- **Test the second click, not just the first.** Contact worked the first time, so it
  looked done. But the Next.js router only scrolls to a `#hash` when the hash changes, so
  clicking it again did nothing, and that ignored click left `contact` saved as a pending
  scroll target, which sent my name to the footer next. Links to the page I'm already on
  now scroll there themselves, and the page checks click each link more than once.
