import { Fragment } from "react";
import StringDivider from "@/components/layout/StringDivider";

/*
 * About: who I am, what I'm looking for, what I've used, and what I do off
 * the clock. It sits between The Collection and the footer, and the nav's
 * About link ("/#about") lands on it.
 *
 * A Server Component with no client code and nothing to Tab to: the
 * Collection carries the visuals, so this is the quiet text room. The one
 * piece of brass is the oil-painting placard, styled like the Collection's
 * "Medium:" placards, because it is one.
 */

/**
 * Skills I've actually used, grouped. Names match the Collection's Medium
 * placards (projects.ts), so "Spring Boot" or "PostgreSQL" reads the same in
 * both places. Tools a placard lists but I haven't used yet (PyTorch,
 * LightGBM, OpenCV, ...) stay on the placard and off this list until I have.
 */
const SKILLS: readonly { group: string; items: readonly string[] }[] = [
  { group: "Languages", items: ["Python", "Java", "JavaScript", "TypeScript", "C++", "HTML/CSS", "Swift", "R"] },
  { group: "Backend", items: ["Spring Boot", "FastAPI", "Node.js", "Express", "PostgreSQL", "MongoDB", "Redis"] },
  { group: "Data", items: ["pandas", "NumPy", "scikit-learn", "XGBoost"] },
  { group: "Frontend", items: ["React", "Next.js", "Tailwind CSS", "Canvas 2D"] },
  { group: "Tools", items: ["Git", "GitHub Actions", "Docker", "Vercel", "Gemini API", "OpenAI API"] },
];

/** The small uppercase label over each group, like "Study" on the Collection's study cards. */
const groupHeading = "font-sans text-sm font-medium tracking-[0.14em] text-mist uppercase";

export default function About() {
  return (
    <section id="about" aria-labelledby="about-title" className="bg-night">
      <StringDivider />
      {/* page-container (globals.css): the same column as the Collection, header, and footer. */}
      <div className="page-container flex flex-col gap-10 pt-12 pb-16 sm:pt-16 sm:pb-20">
        <div className="flex max-w-[44em] flex-col gap-4">
          <h2 id="about-title" className="text-[clamp(30px,4vw,44px)] leading-tight">
            About
          </h2>
          {/* The tagline, as the section's opening line. A paragraph, not a heading: it's a statement, not a title for what follows. */}
          <p className="font-heading text-[clamp(22px,2.6vw,30px)] leading-snug">
            I build systems that prove how well they work.
          </p>
        </div>

        {/*
          Phones: one column, bio first. Wide screens: the bio on the left,
          Skills and Off the clock beside it. The bio's lines are capped at
          36em so they stay easy to read at any width.
        */}
        <div className="flex flex-col gap-12 lg:grid lg:grid-cols-12 lg:gap-12">
          <div className="flex max-w-[36em] flex-col gap-5 leading-relaxed text-haze lg:col-span-7">
            <p>
              I&apos;m Harrison, studying CS &amp; Math at Queens College (expected May 2028) and a
              Data Science Fellow at CUNY Tech Prep. I&apos;m looking for internships in backend
              (Spring Boot, PostgreSQL) and data science.
            </p>
            <p>
              I&apos;ve completed Math 340, 341, 342W, and 343, the math courses of Queens
              College&apos;s data science track, all taught in R. I&apos;m most interested in
              machine learning, computer vision, natural language processing, and graphics.
            </p>
            <p>
              Every project I&apos;m building is designed around the same loop: measure what
              actually happens, predict with honest probabilities, score those predictions, and
              learn from the results. Aurora, the one I&apos;m building now, will keep a public,
              tamper-evident record of its forecasts, so anyone can check how often it&apos;s
              right.
            </p>
          </div>

          <div className="flex flex-col gap-10 lg:col-span-5">
            <div className="flex flex-col gap-4">
              <h3 className={groupHeading}>Skills</h3>
              {/*
                A description list: each group name (dt) and what's in it
                (dd). As a two-column grid, the names line up in one column
                and the lists in the other.
              */}
              <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2.5 leading-relaxed">
                {SKILLS.map(({ group, items }) => (
                  <div key={group} className="col-span-2 grid grid-cols-subgrid">
                    <dt className="font-semibold text-starlight">{group}</dt>
                    <dd className="text-haze">
                      {/* Each name stays on one line, so "OpenAI API" or "Canvas 2D" never breaks in the middle; lines wrap only after a comma. */}
                      {items.map((item, i) => (
                        <Fragment key={item}>
                          {i > 0 && ", "}
                          <span className="whitespace-nowrap">{item}</span>
                        </Fragment>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="flex flex-col gap-4">
              <h3 className={groupHeading}>Off the clock</h3>
              <ul className="flex flex-col gap-4 leading-relaxed">
                <li className="text-haze">
                  <span className="font-semibold text-starlight">Electric guitar:</span> rock,
                  R&amp;B, and jazz
                </li>
                <li>
                  {/* The same placard as the Collection's paintings: a panel edged with a brass hairline. */}
                  <div className="flex flex-col gap-2 rounded-sm bg-panel p-5 ring-1 ring-brass/60">
                    <h4 className="text-xl leading-tight">
                      Oil painting
                      {/* The dot is visual; screen readers hear a comma instead of "middle dot". */}
                      <span aria-hidden="true" className="text-brass">
                        {" "}
                        ·{" "}
                      </span>
                      <span className="sr-only">, </span>
                      <span className="text-haze">aspiring</span>
                    </h4>
                    <dl className="flex flex-col gap-1 text-sm leading-relaxed text-mist">
                      <div>
                        <dt className="inline font-semibold text-brass">Subjects:</dt>{" "}
                        <dd className="inline">the sea, the aurora, and Venice</dd>
                      </div>
                      <div>
                        <dt className="inline font-semibold text-brass">Influences:</dt>{" "}
                        {/* <cite> marks the title of a work, and browsers italicize it. */}
                        <dd className="inline">
                          Kozue Amano&apos;s <cite>Aria</cite>
                        </dd>
                      </div>
                      <div>
                        <dt className="inline font-semibold text-brass">Medium for now:</dt>{" "}
                        <dd className="inline">code (the canal above)</dd>
                      </div>
                    </dl>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
