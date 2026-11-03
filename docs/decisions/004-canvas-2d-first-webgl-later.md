# ADR-004: Canvas 2D first, WebGL later
Date: 2026-11-03
Status: Accepted

## Context
The code-generated hero painting (ADR-003) needs a rendering technology. A stroke-based renderer is already prototyped in reference/painted-canal.html using Canvas 2D.

## Options considered
- **Canvas 2D**: simpler API, already prototyped, works everywhere. Limited in how many strokes it can draw per frame.
- **WebGL via React Three Fiber**: GPU rendering allows many more and finer strokes, but adds complexity and a larger dependency.

## Decision
Start with Canvas 2D. WebGL via React Three Fiber can come later for more and finer strokes, with the Canvas 2D version kept as the fallback and as a still frame for reduced motion.

## Consequences
- Easier: the prototype ports directly; fewer dependencies and less JavaScript at launch.
- Harder: stroke count and detail are capped by Canvas 2D performance until the WebGL version exists.
- When WebGL is added, two renderers must be kept visually consistent.
