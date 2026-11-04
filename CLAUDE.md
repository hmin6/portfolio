@AGENTS.md

# Portfolio: Harrison Min

Personal portfolio for backend (Spring Boot/PostgreSQL) and data science roles.

## Stack
- Next.js (App Router) + TypeScript + Tailwind CSS, deployed on Vercel
- Fonts via next/font/google: Fraunces (headings), Inter (body)
- Case studies in MDX
- Everything must stay free to host

## Design concept: "Night"
- Hero: a live, code-generated oil painting of a Venetian-style canal under the aurora,
  painted with brushstrokes on a canvas each frame. Modes: Night, Golden hour, Day.
  Floating lanterns on click. Reference prototype: reference/painted-canal.html
- Palette: night #0B1026, panel #1A2147, aurora green #3DFFB0, teal #2DD4BF,
  violet #8B5CF6 (decorative only, not text), magenta #E879F9 (sparing),
  starlight text #E8ECF8, brass accent #E0B66A
- Projects shown as framed paintings in "The Collection," each with a
  "Medium:" placard listing the tech stack and a "liner notes" case study page
- String dividers: thin brass (#E0B66A) SVG lines between sections, slightly wavy like a
  guitar string at rest; on hover they briefly vibrate like a plucked string, then settle.
  Decorative only (aria-hidden), and still with prefers-reduced-motion
- Motion is slow and calm; everything respects prefers-reduced-motion

## Projects
Featured (in progress). These are the only projects shown on the site:
- Aurora: a probabilistic aurora/space-weather forecaster. It publishes calibrated
  probabilities, records every forecast in an append-only ledger before outcomes are
  known, and scores itself against NOAA's forecasts. Python (statistics/ML), Spring Boot,
  PostgreSQL, GitHub Actions. Its live forecast will later drive the aurora in the hero.
- Pigment: search and recolor paintings by their full color distributions (Gaussian
  mixtures, optimal transport), using museum open-access collections. Python, Spring Boot,
  PostgreSQL + pgvector, Redis, TypeScript.
- Ensemble: lets musicians in different places record parts that line up to the sample,
  using clock sync and device latency calibration. Spring Boot (WebSocket), PostgreSQL,
  Redis, Web Audio API, TypeScript.

Projects are built in layers. Each project page shows its current status and a changelog.
Never present unbuilt features as finished. Hackathon projects are not shown on the site.

## Git workflow
- Every task starts from a GitHub issue. Read it with `gh issue view <number>`.
- Branch name: `<issue-number>-short-description`, created from latest main.
- Commit messages follow Conventional Commits (feat:, fix:, docs:, chore:, refactor:).
- Open PRs with `gh pr create`, fill in the template, and include "Closes #<number>".
- Never push directly to main.
- Don't add "Generated with Claude Code" to PR descriptions or Co-Authored-By lines to commits.

## Working rules
- Small, focused changes; explain non-obvious code so I can learn from it
- Run `npm run build` and `npm run lint` before saying a task is done
- Accessible: semantic HTML, keyboard focus, good contrast, alt text
- After each PR, draft a devlog entry in docs/devlog/ named <issue-number>-short-name.md,
  following docs/devlog/TEMPLATE.md. Before writing "What I learned," ask me 2–3 short
  questions about what was new, surprising, or difficult for me, then write the section
  in first person from my answers. Keep my wording where possible.
- Record major technical decisions as ADRs in docs/decisions/, following
  docs/decisions/TEMPLATE.md, numbered ADR-001, ADR-002, and so on.
