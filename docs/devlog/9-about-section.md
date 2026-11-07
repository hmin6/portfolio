# #9 Build the About section
Date: 2026-11-06
PR: #33

## What I did
Built the About section between the Collection and the footer, and added "About" to the nav:
- **Opening line:** "I build systems that prove how well they work.", set in Fraunces under the heading.
- **Bio:** CS & Math at Queens College (expected May 2028), Data Science Fellow at CUNY Tech Prep, looking for internships in backend (Spring Boot, PostgreSQL) and data science. Then the loop every project is designed around, and last Math 340, 341, 342W, and 343 (taught in R) and my interests.
- **Skills** in five groups (Languages, Backend, Data, Frontend, Tools), listing only what I've used.
- **Off the clock:** electric guitar, and an oil-painting placard styled like the Collection's Medium placards.

After review, I shortened the Collection intro to "Three solo projects. Work in progress hangs framed; planned work is shown as studies." It had repeated the "measure, predict, score, learn" sentence from About almost word for word, one scroll apart, so the loop is now told only in About.

I also reordered the bio paragraphs without changing any wording. The loop paragraph moved from last to second, right after the paragraph about Queens College and internships. Now the loop comes right after the one-paragraph introduction, as close to the tagline as it can be, instead of after the coursework.

I also extended `npm run measure:hero -- --page` to check About and the About link. Before starting, I opened #32 for the repo README and updated the repo's About details on GitHub (homepage, description, topics).

## Why
The hero and the Collection show what I build, but not who I am or what I'm looking for. Recruiters for backend and data science internships need that in one place: school, fellowship, coursework, and skills, without it crowding out the projects.

## How it works
- **A Server Component with nothing interactive.** No client JavaScript, no links, nothing that moves, so About adds no Tab stops. The nav link is the only new one.
- **Skills only once used.** The Medium placards list planned stacks, so a tool there isn't automatically a skill. The skills list is separate and names only what I've used. Names are spelled the same way as on the placards ("Spring Boot", "PostgreSQL", "GitHub Actions"), and placard tools I haven't used yet (PyTorch, LightGBM, OpenCV, SciPy, statsmodels) are left off.
- **Description lists.** Skills is a `<dl>`: each group name is a `<dt>`, and its contents a `<dd>`. Each group's pair is wrapped in a `<div>`, and the list is a two-column grid with CSS subgrid, so the group names line up in one column and the contents in the other. The placard's Subjects / Influences / Medium for now lines are a `<dl>` too.
- **No breaks inside a name.** Each skill is wrapped in a `whitespace-nowrap` span, so lines only wrap after a comma and "OpenAI API" or "Canvas 2D" never splits.
- **Small accessibility details.** The placard's middle dot is `aria-hidden`, with a visually hidden comma in its place, so a screen reader says "Oil painting, aspiring" instead of "Oil painting middle dot aspiring." *Aria* is in a `<cite>`, the element for the title of a work, which browsers show in italics.
- **Layout.** One column on phones. On wide screens the bio is on the left with lines capped at 36em, and Skills and Off the clock are on the right. It uses the shared `page-container`, so its edges line up with the header, Collection, dividers, and footer.
- **Checks.** `measure:hero -- --page` now checks that About follows the Collection and is last in `<main>`, its heading, opening line, groups, and placard, and that it has no focusable elements, animations, or horizontal scroll. It clicks About twice and saves About screenshots.

## Problems I hit
- **The Collection check would have failed.** It asserted that the Collection was the last thing before the footer. With About after it, that would be false even though the page was fine, so I updated the check along with the layout, before the first run. It now expects About to follow the Collection, and About took over the "last before the footer" check.
- **The About link can't always scroll About to the top.** On a 1440×900 screen, About plus the footer is shorter than the screen, so the browser scrolls as far as it can and stops with About partway down. That's correct behavior, not a bug, so the check counts About as reached if its top is at the top of the screen, or the page is at the bottom with About's top on screen.
- **Three links don't fit at 320px.** With Work, About, and Contact, the nav switches to the Menu button on the narrow viewport. This is the fallback from #7 working as designed, and About is in the Menu.
- **"OpenAI API" split across two lines** on desktop, fixed with the no-wrap spans above.
- **A stale server.** Stopping the background `next start` left its Node process running on port 3000, so the new server failed with `EADDRINUSE`, and the next measurement run checked the old process instead. I stopped it by its process ID, started a fresh server, confirmed it was serving the new build, and re-ran the checks.

## What I learned
- **List only what I've actually used.** The skills come from my resume, which covers
  work I've done, including my hackathon projects. Tools I only plan to use, like
  PyTorch and LightGBM, stay on the draft Medium placards, so nothing on the page claims
  more than I can back up in an interview.
- **Plans should read as plans.** "Is designed around," "will keep," and "aspiring" say
  exactly where each thing stands. The oil painting entry borrows the museum-placard
  format the Collection uses (subjects, influences, medium) while being honest that my
  medium for now is code.
- **Say each idea once, where it belongs.** The Collection intro and the About paragraph
  repeated the same "measure, predict, score, learn" sentence one scroll apart. The loop
  describes how I think, so it now lives only in About, and the Collection intro just
  introduces the projects.
- **Put the strongest point where skimmers will see it.** The loop paragraph backs up the
  tagline, so it moved up to come right after the one-paragraph introduction instead of
  after the coursework.
- **Tests encode layout assumptions.** The measure script's Collection check expected
  the footer to come right after it, so adding About would have failed the check even
  though the page was fine. I updated the check along with the layout, before the first
  run.
- **Make sure you're measuring the right build.** One measurement run hit an old server
  still running on port 3000. Stopping it and re-running against a fresh server serving
  the new build gave the real results.

## Correction
The About section wrongly stated that I'd completed Math 341, 342W, and 343, and listed R as a skill. #38 removed both.
