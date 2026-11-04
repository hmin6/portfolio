# #5 Fix night contrast and the mobile layout in the hero
Date: 2026-11-03
PR: #21

## What I did
Made the hero readable in every mode and on every screen size:
- A text scrim and a light text shadow under the heading and intro.
- A two-color focus ring, site-wide, and two-tone pill edges.
- The hero as a flex column, with a phone layout for the controls and 44px mode buttons.
- Night-mode lighting on the rooflines and behind the gondola.
- Brushstrokes sized to the scene instead of a breakpoint.
- Resizing and phone rotation now keep the painting instead of wiping it and replaying the opening reveal.

I also added `scripts/measure-hero.mjs` (`npm run measure:hero`) to measure all of this, and ADR-007 on keeping text readable over a live painting.

## Why
PR #20 left a list of follow-ups:
- The intro was hard to read in Day.
- The focus ring was weak over bright skies.
- The controls crowded the heading on phones.
- The mode buttons were under 44px.

Measuring showed it was worse than it looked: the heading was as low as 1.36:1 in Day on a 320px screen, the focus ring 1.0:1 over the Day sky, and the pill borders about 1.3:1 in every mode. On a phone in landscape the name crossed the fold. And testing #20 on my Galaxy S25 Ultra showed that rotating the phone wiped the painting and replayed the opening reveal.

## How it works
- **Measuring first.** The painting moves and changes with the mode, so there's no single background color to check text against. The script hides the text, screenshots what's behind it, and computes WCAG contrast for every pixel under each line of text.
  - It runs in headless Edge over the DevTools protocol, with no npm dependencies.
  - The pass bar (ADR-007) is the lightest 1% of those pixels at 4.5:1 or better, in every mode, on a desktop and four phone sizes.
  - For the focus ring it pauses the painting, presses Tab for real, and compares screenshots with and without the ring.
- **Text scrim.** An ellipse of `deep` behind the text block, fully dark over the text, fading out over a long distance so it has no edge.
  - It lives inside the text block, so it follows the text at any screen size.
  - `data-mode` on the section lets Tailwind's `group-data-[mode=day]/hero:` variant set its strength per mode: 50% Night, 60% Golden hour, 80% Day.
- **Two-color focus ring** (WCAG technique C40). An aurora outline between two dark bands; the bands are a box-shadow, also available as `shadow-focus`. Aurora against `deep` is about 15:1, so whatever is behind the ring, one of the two colors has 3:1 against it. Pills use the same idea: a light border with a dark ring outside it.
- **Layout.**
  - The controls and text are now in normal flow inside a flex column, instead of both being absolutely positioned. On a short screen they can't overlap; the hero grows taller instead.
  - The heading size is `min(max(52px, 9vw), 15svh)`, so it shrinks on short landscape screens.
- **Night lighting.** In `scene.ts`:
  - Aurora light falls on the rooflines and upper walls, and the lower walls fall into shadow.
  - A soft teal band of reflected light on the water sits behind the gondola, so its dark hull reads as a silhouette.
  - On portrait screens the gondola moves up so the text doesn't cover it.
- **Stroke size.** Strokes scale with how many CSS pixels one scene pixel covers on this screen (the desktop reference is 4), instead of switching at 700px. The stroke budget's ceiling scales with screen area.
- **Rotation.**
  - On resize, the engine copies the canvas aside (resizing a canvas clears it) and draws it back stretched to the new size. The scene is laid out in fractions, so after stretching the horizon and buildings line up with the new layout, and normal strokes refine it.
  - The counter that drives the opening reveal is no longer reset. A separate count of frames since the resize decides whether pausing needs a repaint.
  - Lanterns are rescaled to the new scene size so they stay on the water.

Results, worst case anywhere:

| Check | Before | After |
|---|---|---|
| Heading | 1.36:1 | 5.58:1 |
| Intro | 3.17:1 | 8.84:1 |
| Focus ring | 1.00:1 | 3.91:1 |
| Pill edges | 1.31:1 | 3.18:1 |
| Bare canvas right after a rotation | 11–35% | 0% |

## Problems I hit
- **The first numbers were wrong in three different ways.**
  - The ring check assumed the new two-color ring was already there, so it gave `main` credit for a dark band it didn't have. I changed it to Tab to each control and measure the ring as drawn.
  - The wall check landed on lit windows.
  - Rounding device-pixel positions sampled the wrong row at 1×, so a pill's border measured as the fill next to it.

  Each was found by dumping the worst sample points and reading the raw pixels, instead of trusting the summary.
- **A light border can't beat a mid-tone.** With a 55% border and a 60% dark ring, the pill edges stayed around 2.4:1. The failing points were where the painting behind was a mid-tone (luminance about 0.1). Against that, even pure `deep` can't reach 3:1, so the light side has to carry it. C40 says the two tones need to be at least 9:1 apart; the 55% border was only about 6:1 from the ring. Going to 80% fixed it.
- **The scrim looked like a dark box.** The first version was a blurred rectangle, and in Day it had a visible right edge. A large radial gradient that stays solid over the text and then fades over a long distance reads as shading in the painting instead.
- **"Golden hour" slid under the Day button at 320px.** `flex-1` sets the flex basis to 0, and my `min-w-11` replaced the default `min-width: auto` that normally stops a flex item from shrinking below its content. `flex-auto` starts from the label's width instead.
- **The pill borders dimmed only at 320px, and I chased the wrong cause.** I first thought it was fractional pixel positions on the blurred pills, and rounding the padding with CSS `round()` didn't help. The real cause was stacking: the text block comes after the controls and uses `isolate`, so its scrim paints on top of anything earlier in the page. On a narrow phone the text block is tall enough for its scrim to reach the controls. `z-10` on the controls fixed it, and I reverted the rounding.
- **Lighter Night walls traded one contrast for another.** Rooflines and the gondola got clearer, but walls next to the bright aurora measured lower than before (2.77 to 1.75 on a portrait phone). The screenshots still show them as separate shapes, so I kept it and wrote the numbers down instead of hiding them.

## What I learned
- **Measure contrast against what's actually behind the text.** The painting moves and
  changes with the mode, so one color pair can't describe it. Measuring every pixel
  behind each line of text, in every mode and screen size, showed Day mode and small
  phones were the real problems, with the heading as low as 1.36:1.
- **Automated checks need checking too.** The measurement script had three bugs at
  first, including sampling the wrong pixel row and giving `main` credit for a focus
  ring band it didn't have. A check that looks precise can still be measuring the wrong
  thing, so I rerun "before" numbers with the final script and sanity-check results
  against screenshots.
- **Pick a pass bar and state the exceptions.** The bar was the lightest 1% of pixels
  behind every line at 4.5:1. One pixel behind the heading measured 4.34:1, probably a
  lantern's glow. Since the heading is large text (AA only asks 3:1), we documented it
  in the ADR instead of hiding it.
- **Two-color focus rings work on any background.** An aurora ring with a dark band
  next to it guarantees one of the two colors contrasts with whatever is behind it,
  which is why it now passes over both the dark night sky and the bright day sky.
- **Stacking order decides what covers what.** The text block's scrim was painting over
  the control pills because of `isolate` and the pills coming earlier in the page.
  Where an element appears in the HTML and which stacking context it's in can matter
  as much as its colors.
- **Resizing a canvas erases it.** To keep the painting when the phone rotates, the
  engine copies the canvas aside, resizes it, and stretches the copy back in. Because
  the scene is laid out in fractions of its size, the old painting lines up with the new
  one. The opening reveal has its own counter that a resize never resets, which is what
  removed the speed-up on rotation.
