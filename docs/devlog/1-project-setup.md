# #1 Set up CI, PR template, and project docs
Date: 2026-11-03
PR: #2

## What I did
Set up the project tooling and docs before feature work begins: a CI workflow, a PR template, CLAUDE.md with project context, templates for devlog entries and ADRs, the first five ADRs, and the painted-canal prototype saved as a reference.

## Why
Every later change should go through the same workflow: an issue, a branch, a PR checked by CI. Writing down the stack, design concept, and early decisions now gives later work (and anyone reviewing it) a clear starting point.

## How it works
- `.github/workflows/ci.yml`: GitHub Actions runs `npm ci`, `npm run lint`, and `npm run build` on Node LTS for every pull request and every push to main. `cache: npm` reuses downloaded packages between runs to speed up installs.
- `.github/pull_request_template.md`: GitHub pre-fills new PR descriptions with this template (what changed, why, how to test, checklist).
- `CLAUDE.md`: project context for Claude Code. Its first line, `@AGENTS.md`, imports the Next.js-generated AGENTS.md so both sets of instructions load together.
- `docs/devlog/TEMPLATE.md` and `docs/decisions/TEMPLATE.md`: templates for devlog entries (one per PR) and Architecture Decision Records.
- `docs/decisions/001` through `005`: ADRs for Next.js over Astro, the free hosting stack, the code-generated hero painting, Canvas 2D before WebGL, and the issue-driven workflow.
- `reference/painted-canal.html`: the standalone prototype of the brushstroke canal painting, kept as a reference for building the hero.

## Problems I hit
- **Node version warning**: create-next-app warned that Node 22.11.0 was below what eslint-visitor-keys requires (^22.13.0). Fixed by updating Node to the current LTS.
- **master vs. main**: the repo was created with a `master` branch. Renamed it to `main`, updated the GitHub default branch, deleted `master`, and set git's global `init.defaultBranch` to `main` so new repos start on `main`.
- **npm audit warnings**: npm audit reported moderate vulnerabilities in dev dependencies. Chose not to run `npm audit fix --force` because it can install breaking major versions.
- **Generated AGENTS.md**: Next.js generated an AGENTS.md file. Kept it and imported it from CLAUDE.md instead of duplicating its content.

## What I learned
