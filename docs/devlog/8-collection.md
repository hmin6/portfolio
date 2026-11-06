# #8 Build the Collection from a projects data file
Date: 2026-11-05
PR: #28

## What I did
Built "The Collection," the section between the hero and the footer that shows my three projects:
- **Aurora** (in progress) as a framed painting with a brass "Medium (draft):" placard and an "In progress" label.
- **Woodshed** and **Pigment** (planned) as "studies": pencil sketches on dashed cards, labeled "Planned, after Aurora" and "Planned, after Woodshed," with draft Medium lines and no brass or frame.

Everything comes from one typed data file, `src/app/projects.ts`. I also added "Work" to the nav, extended `npm run measure:hero -- --page` to check the Collection, and wrote ADR-010. Before starting, I updated the project lineup in CLAUDE.md and in the issues (#8, #9, #11, #12, #17): Ensemble is gone, Pigment is now a paint-mixing coach, and Woodshed is new.

## Why
The portfolio needs to show what I'm building without overstating it. Aurora is in progress and the other two are only planned, so the page has to make that obvious at a glance. A planned project mustn't look like a finished painting, and no card can link to a site or page that doesn't exist yet.

## How it works
- **Kind comes from status.** `kindOf(status)` returns `"study"` for planned projects and `"painting"` for everything else. Kind isn't stored, so the two can't disagree, and when Woodshed moves to "in-progress" it gets framed automatically.
- **Links only when they exist.** `links.site`, `links.repo` (shown as "Source on GitHub"), and `links.linerNotes` are optional. `site` and `repo` must be `https://` URLs, which a template literal type enforces, and the card renders only the links that are set. Today none are, so the Collection has nothing to Tab to.
- **Draft Medium.** Every placard says "Medium (draft):" while `medium.draft` is true. A comment in `projects.ts` says to drop "draft" when Aurora reaches "First light" and trim the list to what's actually in use.
- **Artwork drawn on the server as SVG.** No canvas, no JavaScript, no motion. The Aurora painting is short, curved, translucent strokes in layers: sky texture, stars, and a soft glow behind the curtains (radial gradients, not blurs). Then come the curtains themselves: rays that are green at the bottom, teal higher up, with a violet fringe. They rise to uneven heights, lean one way and then the other, and bunch brighter at three folds where the curtain turns. Last come a glowing lower edge and the reflection: the rays flipped at the waterline, squashed, blurred, and broken up by dark ripple lines painted over them. The studies are pencil line art drawn twice with a slight wobble, plus construction lines and hatching. Colors are the Night tokens as CSS variables.
- **Seeded randomness.** With Cache Components, `Math.random()` while prerendering is an error. A seeded generator (mulberry32) is pure computation, so the page stays fully static and every build draws the same picture.
- **Layout.** On phones it's one column in build order. On wide screens the painting has its own row with its placard beside it, the placard's bottom edge level with the frame's like a museum label, and the two studies sit side by side below it. The header row, the string dividers, the Collection, and the footer share one content column, a `page-container` utility in `globals.css`: full width with the page gutter (16–48px) up to 1440px, then centered. Their edges line up at every width, while the hero painting stays full-bleed.
- **Timeouts in the measurement script.** Every command to the browser has a 30 s limit, and every step (for example one viewport's contrast pass) has a 5-minute limit. A timeout names the step and the part of it that was running, saves what was measured so far, and exits with code 1.
- **Checks.** `npm run measure:hero -- --page` now checks where the Collection sits, its heading, each card's name, kind, status, and Medium label, the artwork labels, links, focusable elements, and animations. It also clicks Work twice and checks that the Collection lands at the top of the screen, and saves screenshots of the Collection.

## Problems I hit
- **The painting was 63 KB.** 557 separate `<path>` elements, each with its own color, width, and opacity. A Server Component's output is sent twice, as HTML and again in the RSC payload React reads when it takes over the page. Merging strokes that share a layer, color, width, and opacity into one path cut that to 21 KB. After I made the curtain denser it was 97 paths and 33 KB. Adding the reflection, folds, and glow brought it to 115 paths and 41 KB (14 KB compressed), and the home page is 167 KB of HTML (59 KB compressed). Strokes inside one path don't build up where they cross, so widths and opacities are rounded to a few steps and the layering happens between groups instead.
- **The first aurora looked like grass.** Separate stiff stalks and a bright lower edge that read like a fence. Thinner, fainter, more numerous rays that lean together like a draped curtain, and a hem of many short faint strokes, fixed it.
- **The glow had a hard edge.** An SVG filter's region is sized from the shape's outline by default, which ignores stroke width, so the blur on a 44-unit-wide stroke was cut off in a band. Setting the region in the painting's own units (`filterUnits="userSpaceOnUse"`) fixed it.
- **The metronome came out as an egg.** The smoothing that makes organic shapes look hand-drawn rounded a four-point trapezoid into a blob. Shapes with corners are now drawn edge by edge with slightly overshooting lines.
- **The measurement script assumed one `<section>`.** Many hero checks used selectors like `section button` and `querySelector("section")`, which only worked because the hero came first. They now find the hero by `[aria-labelledby=hero-title]`, so Collection links added later can't end up in the hero's focus-ring checks.
- **A measurement run hung for over two hours.** `npm run measure:hero -- --page` stopped after the phone's Night screenshot, on the step that switches to Golden hour, and never finished or failed. Re-runs didn't hang, so I never found the cause. Every wait in the script is either a `sleep` (which always ends) or a command waiting for the browser's answer, so a hang means an answer that never came. Each command now has a 30 s limit and each step a 5-minute limit, and a timeout fails the run with a message naming the step, for example `Timed out: Runtime.evaluate got no answer from the browser within 30 s, during step "page phone" (Golden hour: top and bottom screenshots).` Why those numbers:
  - **30 s per command.** The longest a command is meant to take is 15 s (the in-page wait for a still frame), and measured with every option on, the slowest was 2.2 s. Twice the designed maximum leaves room for a slower machine, and a hang fails in half a minute instead of hours.
  - **5 minutes per step.** The slowest step took 116 s ("contrast phone"); the rest took 13–107 s. It's a backstop for a step that keeps getting answers but never finishes, so it doesn't need to be tight.
  - I tested both by running copies of the script with a 3 s command limit plus an evaluate that never resolves, and with a 5 s step limit. Each failed within 8 s with the right message, kept a partial report, and left no browser running.
- **The Collection didn't line up on wide screens.** I had capped it at 1536px and left it on the left, while the header and footer stretched across the whole screen. At 2560px it looked left-aligned, and its right edge was far from the footer's. The fix is one shared container (`page-container`): 1440px maximum, centered, with the same gutter. I picked 1440px because at that width and below the layout is exactly what I designed and measured. Past it, the painting and cards would only grow and spread apart, and the text is already capped at a readable line length. A small script measured the left and right edges of the name, nav, Collection heading and grid, dividers, and footer at 320, 412, 1440, 1920, and 2560px; they match at every width.
- **A test that clicked off screen.** The first "my name after Work" check failed because the header isn't sticky: scrolled to the Collection, the link was off screen. Like the Contact test, it now scrolls near the top first.

## What I learned
- **Let the types enforce the rules.** A project's kind (framed painting or study) is
  worked out from its status instead of stored separately, so a planned project can
  never be framed by mistake. The rule from CLAUDE.md lives in the code, not just in
  my head.
- **Static pages can't use true randomness.** With Cache Components, calling
  `Math.random()` while prerendering is an error. A seeded random generator is plain
  computation, so the artwork draws exactly the same on every build and the page stays
  fully static.
- **Choose the lightest tool that does the job.** The artwork is SVG generated on the
  server instead of three more canvases: no extra JavaScript, nothing competing with the
  hero for the main thread, sharp at any size, and no motion to handle for reduced
  motion.
- **Measure what you ship.** Next.js sends server-rendered markup twice, once as HTML
  and again in the data React uses to take over the page, so the painting's size counts
  double. Grouping strokes into shared paths cut it from 63 KB to 21 KB. Making the
  curtain denser brought it to 33 KB, and adding the reflection, folds, and glow to
  41 KB. ADR-010 says what to do if more artwork pushes the page up.
- **Tools need timeouts too.** One measurement run hung for over two hours. Each browser
  command now has a 30-second limit (twice the longest designed wait) and each step a
  5-minute backstop, so a stuck step fails fast with a message naming where it stopped.
- **Review your own screenshots.** The first aurora looked like grass and the metronome
  came out egg-shaped. Nothing in lint, build, or the contrast checks could catch that;
  only looking at the result did.
- **One shared container keeps edges aligned.** On a 2560 px monitor, the Collection
  stopped at about 1,500 px and sat to the left while the header and footer spanned the
  full width. A single centered `page-container`, capped at 1440 px, now lines up their
  edges at every width.
