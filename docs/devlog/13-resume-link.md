# #13 Add resume PDF and contact links
Date: 2026-11-10
PR: #40

## What I did
Linked my resume from two places:
- **Hero:** a **Resume (PDF)** button beside GitHub. GitHub stays the primary action, filled with aurora. Resume is the same size but an outline pill, like the hero's controls, so it reads as the quieter of the two.
- **Footer:** a fourth Contact link, **Resume (PDF, Google Drive)**.

The email, GitHub, and LinkedIn links were already in the footer from #7, so this issue only needed the resume. I left it out of the header nav and About. A fourth nav link would likely push phones into the Menu button, and the hero puts the resume on the first screen anyway.

I also added an "Updating the resume" section to the README, extended `measure:hero` to measure the new button, and retook the README screenshot, which now shows it.

## Why
Recruiters should be able to get to my resume from the first screen without hunting for it. The issue originally asked for the PDF in `public/`. I host it on Google Drive instead, so its version history stays private: anything committed to a public repo stays in its history forever, even after I replace the file.

## How it works
- **One URL.** `SITE.resume` in `src/app/site.ts` holds the Drive `/view` link, without `?usp=sharing` (that only records how the link was shared). The hero and footer both read it.
- **Updating without a deploy.** Drive's Manage versions → Upload new version keeps the file's ID, so the link and the site never change. Only people with edit access can see earlier versions. The README has the steps.
- **Link text says where it goes.** "Resume (PDF)" in the hero and "Resume (PDF, Google Drive)" in the footer. The visible text is the accessible name, so screen readers announce the same thing people see. The hero keeps the shorter label so the row fits on one line at 320px.
- **Same tab.** No `target="_blank"`, matching the footer's existing rule: Back returns to the site.
- **A shared pill style.** The pill edge (light border, dark ring, translucent dark fill) moved from `PaintedHero.tsx` into `src/components/painter/pill.ts`. `page.tsx` is a Server Component, and a Server Component that imports from a `"use client"` file gets a client reference for each export, not its value, so the class string wouldn't have arrived.
- **Measuring it.** The Resume button sits over the painting, so `measure:hero` now treats it like the other controls:
  - When the script hides text for the background screenshot, hero links keep their fill and lose only their text, so each link's text is measured against its own pill.
  - Hero links with a border count as pills for the edge check.
  - Two new checks: the link row must stay inside the hero's padding with at least 12px between links, and every hero control whose text was measured must also have had its focus ring measured.
- **Results** (lightest 1%, worst across 7 viewports × 3 modes):

  | | Measured | Bar |
  |---|---|---|
  | Text | 16.46:1 | 4.5:1 |
  | Edge | 8.84:1 | 3:1 |
  | Focus ring | 12.61:1 | 3:1 |

  The row is on one line everywhere, and `--page` passes on desktop, phone, and 320px.

## Problems I hit
- **The script hid links completely.** Before the background screenshot, `measure:hero` set hero links to `visibility: hidden`. That was fine for the solid GitHub button, but it would also have hidden the Resume pill's own fill and edge. Its text would then have been measured against the bare painting, and its edge not at all. Now links only lose their text color, like the buttons.
- **The browser dropped out mid-run.** The first full run lost its connection to headless Edge during the iPhone SE Day pass, after a 6.5 s screenshot. A rerun of the SE and 320px viewports passed, so it wasn't caused by the change.
- **A half-written build.** I piped a second `npm run build` through `head` to read its first lines. That ended the build early and left `.next` without a `BUILD_ID`, so `next start` refused to run. A full rebuild fixed it.
- **A stray `package-lock.json` in my home folder** makes Next.js print a `turbopack.root` warning on every build. It's harmless, and unrelated to this change.

## What I learned
- **Where a file lives decides who sees its history.** A PDF committed to a public repo
  keeps every old version visible in the history. Hosting the resume on Google Drive and
  replacing it with "Manage versions" keeps the same link while only I see past
  versions. The LaTeX source lives in a separate private repo.
- **Server components can't borrow values from client files.** Importing from a
  `"use client"` module in a server component gives a reference to client code, not the
  value itself. The shared pill style moved into its own plain module, `pill.ts`, so the
  page and the hero can both use it.
- **New controls need their own measurements.** The script hid the hero's links before
  photographing the painting behind them, so it would have hidden the Resume pill too.
  Now links lose only their text, so its text is measured against its own fill. It
  scored far above the bars (16.46:1 for text, against 4.5:1, and at least 8.84:1 for
  its edge) and barely changed between modes, because it sits low in the hero over the
  dark text scrim. The top controls sit over the sky: their text still passes easily,
  but their edges and focus rings get down to about 3.2:1 and 3.9:1, close to the 3:1
  bar.
- **Put the most important link where people look first.** For most visitors the
  resume matters most, so it sits in the hero next to GitHub, in an outline style so
  GitHub stays the primary action. A fourth nav link would probably have pushed phones
  into the Menu (I estimated that from text widths but didn't build it), and a sentence
  in About felt tacked on. The footer has it too.
- **Say what a link does before people click it.** "Resume (PDF)" says it's a PDF, and
  the footer's "Resume (PDF, Google Drive)" also says it leaves the site. Both open in
  the same tab, so Back returns to the site.
- **A one-off failure isn't a result.** One measurement run lost its connection to the
  headless browser partway through. A rerun of the affected sizes passed, so I treated
  it as a fluke. If it happens again, it gets its own issue.
