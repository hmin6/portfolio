/*
 * The edge of a pill over the painting, shared by the hero's controls
 * (PaintedHero.tsx) and its outline links (page.tsx).
 *
 * It lives in its own plain module, not in PaintedHero.tsx, because that
 * file is "use client": a Server Component like page.tsx that imports from
 * it gets a client reference for each export, not the value, so the string
 * wouldn't arrive.
 *
 * The edge has two tones for the same reason as the focus ring in
 * globals.css: a light border shows against the dark Night sky, and a 1px
 * dark ring (`ring-1`, a box-shadow) outside it shows against the bright
 * Day sky. Anything using it needs `focus-visible:shadow-focus` to keep the
 * focus ring's dark bands, which the ring utility would otherwise replace.
 *
 * Against a mid-tone part of the painting, neither tone reaches 3:1 unless
 * the two are at least 9:1 apart, so the border is 80% starlight (it blends
 * with the dark fill behind it) and the ring is 85% deep. The dark fill also
 * sits behind the pill's text, so starlight text stays readable over any
 * part of the painting.
 */
export const pillEdge = "border border-starlight/80 bg-deep/70 ring-1 ring-deep/85 backdrop-blur-md";
