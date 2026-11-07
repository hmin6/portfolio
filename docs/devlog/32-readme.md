# #32 Write the repo README
Date: 2026-11-07
PR: #35

## What I did
Replaced the default create-next-app README with one written for someone landing on the repo from GitHub, especially a recruiter:
- **Opening:** one line on what the site is ("My portfolio for backend and data science internships."), the live link, and a screenshot of the hero with alt text.
- **Highlights:** the live painted hero, the reduced-motion still, measured text contrast, and the Collection. Each is a line or two and describes only what's built.
- **Stack**, **Running it locally** (including what `measure:hero` checks, what it needs, and what it reports), **How I work** (the project board, one branch and PR per issue, Conventional Commits, CI, the ruleset on main, the devlog, all ten ADRs by title, and a line on using Claude Code), and a short **Project structure** map.

Two smaller changes went with it:
- **`npm run measure:hero -- --readme-shot`** retakes the README's screenshot.
- **The five unused create-next-app SVGs** in `public/` are gone, in their own `chore:` commit.

## Why
The README was still the create-next-app template, so anyone opening the repo saw instructions for a generic Next.js app instead of what this project is and how it's built. The issue also asked for no leftover boilerplate, and the unused SVGs in `public/` were the last of it.

## How it works
- **The screenshot reuses the measure script's headless browser.** `--readme-shot` sets the 1440×900 desktop viewport and turns on reduced motion. With reduced motion, the hero paints a still off screen and swaps it in finished (ADR-008), so the shot is never caught half-painted. The script waits for that swap (the same `WAIT_FOR_SWAP` the still-frame checks use) and for `document.fonts.ready`. Then it calls `Page.captureScreenshot` with `format: "webp", quality: 80`, saves the file, prints its size, and exits.
- **Small file:** 102 KB for a 1440×900 picture. The measure script's PNGs of the same view are about 1.5 MB, because the brushstroke texture is full of fine detail that PNG can't compress well.
- **Where it lives:** `docs/images/hero-night.webp`. Anything in `public/` is deployed with the site, and the site doesn't need this picture, so it stays in `docs/`. `.gitattributes` already marks `*.webp` as binary.
- **Contrast stays a guarantee, not a number.** The README says every line of hero text meets 4.5:1 in all three modes at seven screen sizes, and links to ADR-007 for the measured values. A specific ratio would go out of date the next time the scrim or the painting changes.
- **Checked against the repo:**
  - The live site responds, the project board is public, and the "Protect main" ruleset is active.
  - Next 16 needs Node 20.9+ (`engines` in `node_modules/next/package.json`), and the measure script needs Node 22+.
  - A lantern click only counts below the horizon (`lanternAt` in `engine.ts`), so "click the water" is accurate.
  - `git grep` found no references to the deleted SVGs.

## Problems I hit
- **A scrollbar in the screenshot.** Headless Chrome drew a classic scrollbar down the right edge, which a visitor's browser usually doesn't show. `Emulation.setScrollbarsHidden` removes it for the capture.
- **A wrong claim, caught before review.** The first script comment and PR description said every retake gives the same picture. The painter uses `Math.random`, so each retake is a slightly different painting of the same scene. Both were corrected in a follow-up commit.
- **An out-of-date number.** The first draft quoted 5.58:1 for the heading from ADR-007. I caught that #26 had raised the Night scrim, which changed the heading's worst case to 5.19:1 at 320px in Night (devlog #7; ADR-007's update rounds it to about 5.2:1). The README now states the AA guarantee and links to the ADR instead.
- **`gh issue view 32 --comments` printed nothing** in Claude's shell again, even though it succeeded. `gh issue view 32 --json title,body,comments` worked.

## What I learned
- **Write for the reader who skims.** A recruiter decides in seconds, so the README
  opens with one line about the site, the live link, and a screenshot, then short
  highlights. It only describes what's built: the case-study pages and Aurora's site
  link stay out until they exist.
- **State the guarantee, not a number that drifts.** The draft quoted the heading's
  worst case as 5.58:1, but PR #26 had changed it to 5.19:1. The README now promises
  that every line meets WCAG AA's 4.5:1 and links to ADR-007, where the measured values
  are kept up to date.
- **Format and location matter for images.** The screenshot is a 102 KB WebP, compared
  with about 1.5 MB for the measure script's PNG of the same view. It lives in
  `docs/images/` instead of `public/`, so the site doesn't deploy it. The
  `--readme-shot` flag retakes it, and each retake is a slightly different painting
  because the painter uses `Math.random`.
- **Alt text should describe the actual image.** The draft's alt text was written before
  the screenshot existed and said "green and teal aurora." The still frame's aurora is
  teal and violet, so the alt text now says that.
- **Remove boilerplate, then prove nothing broke.** `git grep` found no references to
  the five create-next-app SVGs, and the preview's console showed no 404s after deleting
  them.
- **Not every console message is about my site.** The TypeError came from a browser
  extension's script and the cookie warning from Vercel's preview toolbar. The font
  preload warnings are from the site, but my first guess about them was wrong: the two
  preloaded files are the upright Fraunces and Inter subsets, used right away. The real
  cause is tracked in issue #16.
