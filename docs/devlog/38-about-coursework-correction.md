# #38 Correct the coursework and skills in About
Date: 2026-11-07
PR: #39

## What I did
Removed two wrong claims from the About section: the sentence saying I'd completed Math 340, 341, 342W, and 343 (all taught in R), and R in the Languages list. The third bio paragraph now starts with "I'm most interested in machine learning, computer vision, natural language processing, and graphics."

## Why
The live site said I'd completed courses I haven't, and listed a language I haven't used yet. The About section's skills list is meant to hold only what I've actually used, so R didn't belong there.

## How it works
- `src/components/about/About.tsx`: deleted the coursework sentence from the bio and `"R"` from the `SKILLS` array. The interests sentence now stands as a short paragraph of its own.
- Searched the whole repo for "341", "342W", "343", "completed Math", and R as a skill. The only other match was the #9 devlog, which I left as a historical record. CLAUDE.md, README.md, and the ADRs had nothing to fix.
- Added a comment on #9 noting the correction.
- `npm run lint`, `npm run build`, and `npm run measure:hero -- --page` all pass.

## Problems I hit
Something was already running on port 3000. It turned out to be a leftover node process, which I stopped, but I couldn't be sure which build it was serving. So I started this branch's build on port 3100 with `next start -p 3100`, confirmed it served the new About text, and passed `--url http://localhost:3100/` to `measure:hero`.

## What I learned
- **Accuracy beats impressiveness.** The About section claimed courses I haven't taken
  and a language I haven't used. Anything on the site can come up in an interview, so a
  wrong claim on the live site gets fixed first, before new features.
- **Course numbers mean little outside my school.** "Math 340, 341, 342W, and 343"
  doesn't tell a recruiter what I can do. Removing the sentence made the paragraph
  shorter and clearer, and my resume's coursework section covers my classes.
- **Correct the record instead of rewriting it.** The #9 devlog still shows what I
  wrote at the time, with a correction note pointing to this fix. History stays honest
  about the mistake and how it was handled.
- **Check what's already running.** Something was already running on port 3000. I
  confirmed it was a leftover node process and stopped it, but I couldn't be sure which
  build it was serving, so this branch was measured on port 3100 after confirming it
  served the new text. Now I stop servers with Ctrl + C when I'm done.
