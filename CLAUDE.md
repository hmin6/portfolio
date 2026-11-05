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
Three solo projects, built in layers. These are the only projects shown on the site;
hackathon projects are not shown.

- Aurora (in progress): tells people anywhere in the world whether tonight is worth
  going out to see the aurora, and publicly proves how often it's right. It keeps a
  public, tamper-evident (hash-chained) forecast ledger scored against NOAA and GFZ,
  and grades visibility against what all-sky cameras actually saw. Features: a Tonight
  verdict for any location, push alerts, track record, the ledger, science findings, a
  public API, and later a live 3D globe. It has its own site on a vercel.app address;
  the portfolio links to it.
  Draft Medium: Python, LightGBM, PyTorch, statsmodels, lifelines, Spring Boot,
  PostgreSQL, Next.js, three.js, GitHub Actions.
- Woodshed (planned, after Aurora): a practice coach for guitar and voice that says what
  to practice today, predicts what you're about to forget, and runs experiments on how
  you learn best. It grades from measured playing instead of self-ratings, makes
  calibrated forgetting predictions, and runs personal randomized (n-of-1) experiments
  on practice strategies.
  Draft Medium: TypeScript, Web Audio API, Python, Spring Boot, PostgreSQL.
- Pigment (planned, after Woodshed): a paint-mixing coach. Photograph a reference scene,
  get a palette and mixing recipes, then photograph test swatches so it learns how your
  own paint tubes actually behave. It predicts each mix with an error estimate, measures
  the real result, and improves.
  Draft Medium: Python, NumPy/SciPy, OpenCV, Spring Boot, PostgreSQL, Next.js.

Shared identity: every project measures what actually happens, predicts with honest
probabilities, scores its own predictions, and learns from the results.
Product standard for every project: who uses it, what it helps with, why they should
trust it, and what it does that existing tools don't.

Collection: in-progress and finished projects are framed paintings; planned projects
are "studies," visually distinct and labeled "Planned." Never present unbuilt features
as finished. Each project page shows its current status and a changelog.

Portfolio tie-ins (later): Aurora's live Kp and forecast drive the Night hero's aurora
intensity; Aurora's 3D globe may share shader and color code with the hero.

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
  following docs/devlog/TEMPLATE.md. Write "What I learned" only after I've reported my
  manual checks and any bugs they found are fixed and I've retested them. Until then,
  keep the devlog draft uncommitted and don't ask me the "What I learned" questions.
  Then ask me 2–3 short questions about what was new, surprising, or difficult for me,
  and write the section in first person from my answers. Keep my wording where possible.
- Record major technical decisions as ADRs in docs/decisions/, following
  docs/decisions/TEMPLATE.md, numbered ADR-001, ADR-002, and so on.
- When I report the results of manual checks (for example on my phone or by tabbing
  through the page), update the PR description's checklist with `gh pr edit`: tick the
  boxes I confirmed and add a short note of what I tested. Never tick a box I haven't
  confirmed.
