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
- Motion is slow and calm; everything respects prefers-reduced-motion

## Projects
Featured (in progress): Aurora, Pigment, Ensemble
Earlier works: Mosquito Watch, FireShield, EverGreen, Habit Hero

## Git workflow
- Every task starts from a GitHub issue. Read it with `gh issue view <number>`.
- Branch name: `<issue-number>-short-description`, created from latest main.
- Commit messages follow Conventional Commits (feat:, fix:, docs:, chore:, refactor:).
- Open PRs with `gh pr create`, fill in the template, and include "Closes #<number>".
- Never push directly to main.

## Working rules
- Small, focused changes; explain non-obvious code so I can learn from it
- Run `npm run build` and `npm run lint` before saying a task is done
- Accessible: semantic HTML, keyboard focus, good contrast, alt text
- After each PR, draft a devlog entry in docs/devlog/ named <issue-number>-short-name.md,
  following docs/devlog/TEMPLATE.md. Leave "What I learned" empty for me to write.
- Record major technical decisions as ADRs in docs/decisions/, following
  docs/decisions/TEMPLATE.md, numbered ADR-001, ADR-002, and so on.
