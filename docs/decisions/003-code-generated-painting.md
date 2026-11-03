# ADR-003: Code-generated painting for the hero
Date: 2026-11-03
Status: Accepted

## Context
The "Night" design concept centers the hero on an oil painting of a Venetian-style canal under the aurora. The painting needs a source, and it should support animation and multiple lighting modes (Night, Golden hour, Day).

## Options considered
- **Scan my own oil painting**: the most personal option, but I don't have one yet.
- **AI-generated image**: quick to produce, but could be mistaken for my own painting, and a single flat image is hard to animate in layers.
- **Generate the painting in code**: brushstrokes drawn on a canvas each frame. More work up front, but free, animatable, and able to switch lighting modes.

## Decision
Generate the painting in code. It is free, animatable, supports Night/Golden hour/Day modes, and showcases graphics and math skills. A real painting can be added later.

## Consequences
- Easier: the hero can animate (aurora, water, lanterns) and change modes without new assets; the hero itself demonstrates technical skill.
- Harder: rendering cost must be managed so the page stays fast, especially on mobile; a still frame is needed for prefers-reduced-motion.
- Leaves the door open to adding a real painting of my own later.
