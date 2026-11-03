# #3 Add design tokens and fonts
Date: 2026-11-03
PR: #18

## What I did
Set up the "Night" palette and four neutral colors as Tailwind theme tokens, loaded Fraunces and Inter with `next/font`, added base styles (dark color scheme, heading font, focus ring), and replaced the Create Next App starter page with a temporary preview of the tokens. In a separate commit, updated CLAUDE.md so the site shows only Aurora, Pigment, and Ensemble, and described the string dividers.

## Why
Every component from here on should pull from one shared set of colors and fonts, so the site looks consistent and an off-palette color can't slip in. Checking contrast now means text colors are known to be readable before any real pages use them.

## How it works
- `src/app/globals.css`: Tailwind v4 is configured in CSS. Each `--color-<name>` inside `@theme` creates utilities (`bg-night`, `text-haze`, `border-line`) and a CSS variable (`var(--color-brass)`) for future canvas and SVG code. `--color-*: initial;` removes Tailwind's built-in palette, leaving only the 12 Night colors.
- Fonts: `next/font/google` downloads Fraunces and Inter at build time and serves them from the site, so browsers never contact Google. Each font sets a CSS variable on `<html>`. A separate `@theme inline` block maps those to `font-sans` (Inter, the default) and `font-heading` (Fraunces). `inline` is needed because the variables live on `<html>`, not where the theme is defined.
- Fraunces loads its optical-size axis (`opsz`), which adjusts letter shapes for large headings.
- Base styles: `color-scheme: dark` so browser-drawn controls match, and a 2px aurora `:focus-visible` outline that shows for keyboard users but not mouse clicks.
- Contrast: calculated WCAG ratios for every text color on night and panel. All pass AA except violet (4.44 and 3.67), which stays decorative only. The table is in `globals.css` and the PR.
- Verified in the built CSS that `bg-transparent` and `border-current` still work, and that `bg-deep/80` compiles to `color-mix()` with a hex fallback.

## Problems I hit
- The starter page used built-in colors like `zinc` and `black`. After removing the built-in palette, those classes would silently produce no styles (the build doesn't fail on unknown classes), so the page had to be replaced rather than left as is.
- Violet, a color from the original palette, turned out to fail AA contrast as text on both backgrounds. That confirmed the "decorative only" rule with real numbers.

## What I learned
- **Tailwind v4 moves the theme into CSS.** Instead of a JavaScript config file, colors
  and fonts are defined with `@theme` in `globals.css`. Every token becomes both a utility
  class (`bg-night`, `text-brass`) and a real CSS variable (`var(--color-brass)`), so the
  canvas hero and SVG dividers can use the same colors later.
- **Removing the built-in palette is a design guardrail.** `--color-*: initial;` deletes
  Tailwind's default colors, so only the Night palette exists and off-brand colors can't
  sneak in. I added neutral tokens (haze, mist, line, deep) because a strict palette
  still needs softer text and border colors.
- **Bright-looking doesn't mean high contrast.** Contrast is calculated from luminance,
  which weights green about 72%, red 21%, and blue only 7%, matching how our eyes work.
  Violet looks vivid but is mostly blue and red, so it fails WCAG AA (4.4:1), while
  aurora green scores 14.5:1. I'll check contrast numbers instead of trusting my eyes.
- **Decorative and functional elements have different contrast rules.** Text needs 4.5:1,
  and borders that identify buttons or inputs need 3:1. The `line` color (1.4:1) is fine
  for decorative dividers but not for input borders, which should use `mist`.
- **`next/font` self-hosts fonts.** It downloads Fraunces and Inter at build time and
  serves them from my own site, so visitors never contact Google, and it reserves space
  so the page doesn't shift when fonts load.
- **`@theme inline` controls when a variable resolves.** `next/font` sets `--font-inter`
  on `<html>`. With `inline`, Tailwind's font utilities reference that variable directly
  instead of going through an in-between variable whose value is fixed too early.
