# ADR-010: Collection artwork as SVG drawn on the server, and kind from status
Date: 2026-11-05
Status: Accepted

## Context
The Collection (#8) shows three projects: Aurora, in progress, as a framed painting, and Woodshed and Pigment, planned, as "studies." Each card needs artwork. The hero is already a live painting on a canvas (ADR-003, ADR-006), so the cards need artwork that fits the Night look without competing with it, and that never makes planned work look finished.

Two questions came up together:
1. How the artwork is made.
2. How the data file says whether a project is a painting or a study.

## Options considered
Artwork:
- **A live canvas per card**, using the hero's painter. This would look closest to the hero, but it means three more canvases and more JavaScript, all competing with the hero for the main thread. Each would need its own reduced-motion and Pause motion handling (ADR-008, ADR-009). The cards don't need to move, so that cost buys nothing.
- **Screenshots or exported images** in `public/`, shown with `next/image`. No JavaScript, but brushstroke texture compresses poorly (ADR-008 estimated 60–200 KB per hero size). The images would also need re-exporting whenever the palette changes, and wouldn't follow the CSS color tokens.
- **SVG generated on the server.** A Server Component builds the brushstrokes or pencil lines as SVG paths, using a seeded random number generator, and the result is part of the prerendered HTML. It needs no JavaScript, stays sharp at any size, never moves, and colors the strokes with the Night tokens (`var(--color-aurora)` and so on), so it follows `globals.css`. The cost is page weight: a Server Component's output is sent twice, as HTML and again in the React Server Components payload.

Kind:
- **Store `kind` next to `status`.** Flexible, but the two can disagree, for example a planned project marked as a painting, which is exactly what the Collection rule forbids.
- **Work out kind from status** with `kindOf(status)`: planned projects are studies, everything else is a painting.

## Decision
- **Artwork:** SVG drawn on the server (`src/components/collection/`). `AuroraPainting` lays down an underpaint, then layers of short, curved, translucent strokes: sky texture, stars, aurora rays (green, then teal, with a violet fringe), the curtain's bright lower edge, and reflections on the water. `StudySketch` draws monochrome pencil line art in `mist`: each shape is drawn twice with a slight wobble, lines overshoot their ends, and there are dashed construction lines and hatching.
- **Seeded randomness:** a small seeded generator (mulberry32 in `random.ts`), not `Math.random()`. With Cache Components, `Math.random()` while prerendering is an error. A seeded generator is pure computation, so the page stays static and every build draws the same picture.
- **Grouped strokes:** strokes in the Aurora painting that share a layer, color, width, and opacity are merged into one `<path>`. As 557 separate paths it was 63 KB of HTML (sent twice). Grouped, that same painting was 107 paths and 21 KB. With a denser curtain, folds, a sky glow, and a reflection in the water, it's now 115 paths and 41 KB (14 KB compressed). Inside one path, crossing strokes don't build up like separate translucent strokes, so widths and opacities are rounded to a few steps to keep groups large. The layering survives between groups and between layers. The sketches were grouped by pencil style from the start: four paths each.
- **Kind:** worked out from status with `kindOf`, not stored. Moving Woodshed to `"in-progress"` frames it automatically, and it then needs a painting in `PAINTINGS` (`Collection.tsx`).
- **Placards:** a painting gets a brass placard; a study gets a plain dashed card. Both say "Medium (draft):" while the stack is still planned (`medium.draft` in `projects.ts`). Status is always written out ("In progress", "Planned, after Aurora"), never shown by color alone.
- **Links:** each card shows only the links that are set (`site`, `repo`, `linerNotes`), and they're set only once their targets exist. Today there are none, so the Collection has nothing to Tab to.

## Consequences
- Easier: no client JavaScript, nothing to pause, nothing to re-export, and the artwork follows the color tokens. `npm run measure:hero -- --page` checks that the Collection has no animations and that every artwork has a label.
- Easier: the rule "nothing planned looks finished" is enforced by the types and `kindOf`, not by remembering to set two fields.
- Harder: each new painting or study is code, not a file dropped into `public/`. That fits the site's idea (a painting generated from code) but takes longer than exporting an image.
- Harder: the artwork is about 65 KB of HTML (41 KB painting, 16 KB and 9 KB sketches), and the RSC payload carries it again. The whole home page is about 167 KB of HTML, 59 KB compressed. That's similar to one compressed image, with no extra request. If more paintings are added, the next step is serving each one as a static `.svg` file loaded lazily with `<img loading="lazy">`. That would mean colors written as hex values in the SVG instead of CSS variables, because an `<img>` can't read the page's CSS.
- Harder: a project moving from planned to in progress needs a painting written before its card looks right. Until then the frame shows an empty mat.
