# #29 Align hero text and controls with the page container on wide screens
Date: 2026-11-06
PR: #30

## What I did
On screens wider than 1440px, the hero's heading, intro, GitHub button and controls now line up with the page's content column, the same edges as the header, string dividers, Collection and footer. The painting still fills the full width, and at 1440px and below nothing moved.

After review, on screens wider than 1440px the text scrim now runs out to the hero's left edge as shade from the side, as it looks at 1440, instead of showing as a dark oval on the water.

I also added 1920×1080 and 2560×1440 viewports to `npm run measure:hero`, a check that the hero's text and controls sit on the column's edges, and an update to ADR-007 with the wide-screen contrast results.

## Why
Since #28, everything else on the page has used the shared `page-container` column, which stops growing at 1440px and centers itself. The hero still used the plain 48px gutter, so on a 2560px monitor the heading started at x = 64 while my name in the header, right above it, started at x = 601.

## How it works
- **Padding instead of a wrapper.** The hero is one full-width `<section>` with the painting's canvases absolutely positioned inside it. A new `page-inset` utility in `globals.css` gives the section this inline padding: `max(var(--page-gutter), calc((100% - var(--content-max)) / 2 + var(--page-gutter)))`.
  - A percentage padding is measured against the containing block's width, the same width `page-container` centers itself in. So `(100% - 1440px) / 2` is exactly the column's auto margin, and adding the gutter lands on its content edge.
  - At 1440px and below that margin is zero or negative, and `max()` falls back to the plain gutter, so nothing changes there.
  - Absolutely positioned children ignore padding, so the canvases, vignette, gradients and bottom fade still fill the full width. No new wrapper element, so the hero's flex column (controls at the top, text at the bottom) is untouched.
- **The heading keeps its indent.** The text block has a small left margin (`clamp(4px, 1vw, 16px)`), so it sits 16px inside the column at 1920 and 2560, as it does (14.4px) at 1440. The controls end exactly on the column's right edge.
- **The scrim moves with the text.** It's part of the text block, so it followed the text to its new spot without any change. At 2560px the text moved from over the dark left building to over the open canal, so I measured again rather than assume.
- **Measuring.** The `column` check reads the header row's content edges (its box minus its padding) and compares them with the text block's left edge and the controls' right edge. The script also records the position of every hero element, so I could compare a run on `main` (`--label before`) with a run on the branch (`--label after`): 0.0px change at 1440 and on all four phone sizes.

## Problems I hit
- **Measuring "before" with a new script.** To show before and after with the same check, I committed the script changes first, measured the unchanged layout with them, and only then made the layout change. The before run flagged exactly the problem in the issue: text 536.5px outside the column at 2560.
- **The scrim became a floating oval at 2560 in Day.** Contrast passed with the same scrim at every width. But over open water at 2560 the whole ellipse came into view and read as a dark oval on the light water, while at 1440 its left side runs off the screen and reads as shade from the side. Above 1440px only, the scrim now keeps the oval's right half and swaps its left half for shade that runs out to the hero's left edge.
  - My first idea, a second element for the left part, would have darkened the strip where the two overlap. Instead it's one element with two background tiles side by side, sized so they never overlap. The left tile's top-to-bottom fade is the same as the oval's center column, so they meet without a seam.
  - The right tile is 558px wide: half the text block (310px) plus the 40% (248px) the scrim reaches past it. That only works because the block is always its full 620px above 1440.
  - Tailwind generates CSS for class names it finds anywhere in the source, comments included. Naming the new utility in a comment in `PaintedHero.tsx` produced a second, unused copy of its CSS outside the media query, so the comments describe it without naming it.
  - To show 1440 and below really didn't change, I compared the scrim's computed style and box before and after at 1440 and the four phone sizes: identical.
- **Lanterns don't follow the column.** "Float a lantern" starts lanterns at 5–25% of the painting's width. At 2560 that used to be behind the text; now it's mostly in the left margin. Lanterns belong to the painting, not the page layout, so I left them as they are.

## What I learned
- **One rule can replace breakpoints.** The hero's padding uses `max()` with a
  percentage: at 1440 px and below the calculation comes out zero or negative, so the
  existing gutter wins and nothing moves; above that, the padding grows to match the
  content column's edges exactly.
- **Prove "nothing moved" with positions, not pixels.** The painting is different on
  every load, so a pixel comparison would always show changes. Measuring main first and
  comparing element positions showed 0.0 px of change at 1440 and every phone size.
- **Passing the numbers isn't the same as looking right.** At 2560 in Day mode, the text
  scrim passed every contrast check but read as a dark oval floating on light water.
  Extending it to the hero's left edge, only above 1440 px, made it read as shade
  toward the side of the painting, like it already does at 1440.
- **Tailwind reads class names anywhere in the source.** A comment that named the new
  utility generated an extra, unused copy of its CSS outside the media query, as a plain
  class that nothing used. Rewording the comment and checking the build output fixed it.
