# ADR-002: Free hosting stack
Date: 2026-11-03
Status: Accepted

## Context
The portfolio and the projects it showcases (including Spring Boot backends with PostgreSQL) must stay free to host. Hosts should not require a credit card, and hitting a limit should pause a service rather than produce a bill.

## Options considered
- **Frontend: Vercel Hobby**: free for personal, non-commercial use; pauses instead of billing at limits. Native support for Next.js.
- **Backend: Render free tier**: no card required. Services sleep after 15 minutes idle (slow cold starts) and get 512 MB RAM.
- **Backend: Fly.io, Koyeb**: rejected, no card-free free tier.
- **Database: Neon free Postgres**: scales to zero and suspends rather than bills at limits.
- **Database: Render free Postgres**: rejected, free databases expire after 90 days.

## Decision
Vercel Hobby for the frontend, Render's free tier for Spring Boot services, and Neon free Postgres for databases.

## Consequences
- The frontend must never wait on a backend. Backends may be asleep, so pages render without them and treat backend data as an optional enhancement.
- Everything ships in Docker so any service can move to another host if a free tier changes.
- No credit cards are entered on any host, so there is no risk of surprise bills.
- Spring Boot services must fit in 512 MB RAM and tolerate cold starts.
