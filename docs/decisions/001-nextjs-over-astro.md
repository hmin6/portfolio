# ADR-001: Next.js over Astro
Date: 2026-11-03
Status: Accepted

## Context
The portfolio needs a frontend framework. It is mostly a content site (project pages, case studies), but it is also meant to show skills employers look for and may grow app-like features later, such as live project demos.

## Options considered
- **Astro**: built for content sites, ships less JavaScript by default, and is growing fast. A strong fit for a mostly static site, but less common in industry and job listings.
- **Next.js**: far more common in industry and job listings, built on the React ecosystem, and supports app-like features (server components, API routes, interactive pages) when the site needs them. Ships more JavaScript than Astro by default.

## Decision
Next.js (App Router), chosen for industry relevance and room to grow.

## Consequences
- Easier: experience carries directly to jobs that use React/Next.js; large ecosystem of libraries and docs; adding live demos or app-like pages later needs no framework change.
- Harder: more JavaScript ships to the browser than with Astro, so page weight and performance need deliberate attention (server components by default, client components only where interactivity is needed).
