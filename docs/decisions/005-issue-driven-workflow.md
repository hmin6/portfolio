# ADR-005: Issue-driven workflow
Date: 2026-11-03
Status: Accepted

## Context
Even as a solo project, the portfolio should show how I work on a team and leave a history that others can review.

## Options considered
- **Commit directly to main**: fastest, but leaves no review trail and no checks before changes land.
- **Issue-driven workflow**: every task tracked as an issue, built on its own branch, and merged through a PR with CI. More steps per change, but mirrors professional team practice.

## Decision
Use an issue-driven workflow:
- Work is tracked as GitHub issues on a project board (Backlog, Ready, In Progress, In Review, Done) with automations.
- One branch and one PR per issue.
- Commit messages follow Conventional Commits.
- CI runs lint and build on every PR and on pushes to main.
- A ruleset protects main from direct pushes.

## Consequences
- Easier: every change links back to the issue that motivated it; CI catches broken builds before merge; the history is reviewable by anyone.
- Harder: small changes still need an issue, branch, and PR, which adds overhead.
- Mirrors professional team workflows.
