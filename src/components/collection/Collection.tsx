import Link from "next/link";
import type { ComponentType } from "react";
import { PROJECTS, STATUS_LABEL, kindOf, titleOf, type Project } from "@/app/projects";
import StringDivider from "@/components/layout/StringDivider";
import AuroraPainting from "./AuroraPainting";
import StudySketch from "./StudySketch";

/*
 * The Collection: the projects, hung like a small gallery. Work that's
 * being built is a framed painting with a brass "Medium:" placard. Planned
 * work is a study: a pencil sketch on a dashed card, no frame, no brass, so
 * nothing planned looks finished. Which one a project gets comes from its
 * status (kindOf in projects.ts).
 *
 * A Server Component with no client code: the artwork is SVG drawn on the
 * server, and nothing here moves. Cards only contain links whose targets
 * exist (links in projects.ts), so for now there's nothing in this section
 * to Tab to.
 */

/**
 * The painting for each project that has one. Partial, like the sketches in
 * StudySketch: a planned project doesn't need a painting until it's framed.
 */
const PAINTINGS: Partial<Record<Project["slug"], ComponentType<{ alt: string }>>> = {
  aurora: AuroraPainting,
};

const linkStyle =
  "inline-flex min-h-11 items-center rounded-full text-starlight underline decoration-starlight/40 underline-offset-4 hover:decoration-brass";

/** The project's links, only those that are set. Renders nothing when there are none. */
function ProjectLinks({ project }: { project: Project }) {
  const { site, repo, linerNotes } = project.links;
  if (!site && !repo && !linerNotes) return null;
  return (
    <ul className="flex flex-wrap gap-x-6">
      {linerNotes && (
        <li>
          {/* Link names include the project, so a list of links read out of context still makes sense. */}
          <Link href={linerNotes} className={linkStyle}>
            Liner notes<span className="sr-only">: {project.title}</span>
          </Link>
        </li>
      )}
      {site && (
        <li>
          <a href={site} className={linkStyle}>
            Visit {project.title}
          </a>
        </li>
      )}
      {repo && (
        <li>
          <a href={repo} className={linkStyle}>
            Source on GitHub<span className="sr-only">: {project.title}</span>
          </a>
        </li>
      )}
    </ul>
  );
}

/** "Medium:" or, while the stack is still planned, "Medium (draft):". */
function Medium({ project, className }: { project: Project; className: string }) {
  return (
    <p className={className}>
      <span className="font-semibold">{project.medium.draft ? "Medium (draft):" : "Medium:"}</span>{" "}
      {project.medium.items.join(", ")}
    </p>
  );
}

/** An in-progress or finished project: a framed painting with a brass placard below it. */
function Painting({ project }: { project: Project }) {
  const titleId = `project-${project.slug}-title`;
  const Artwork = PAINTINGS[project.slug];
  return (
    <article
      aria-labelledby={titleId}
      data-kind="painting"
      className="flex flex-col gap-6 lg:grid lg:grid-cols-12 lg:items-end lg:gap-12"
    >
      {/*
        The frame is three nested boxes: a dark `deep` moulding edged with
        brass, a `panel` mat inside it, and the painting. ring-* draws the
        brass hairlines without taking up layout space.
      */}
      <div className="bg-deep p-[clamp(10px,1.6vw,18px)] shadow-[0_24px_48px_-20px_rgb(0_0_0/0.85)] ring-1 ring-brass/70 lg:col-span-7">
        <div className="bg-panel p-[clamp(8px,1.3vw,16px)] ring-1 ring-brass/35">
          <div className="ring-1 ring-deep">
            {Artwork && <Artwork alt={project.artworkAlt} />}
          </div>
        </div>
      </div>

      {/*
        The placard, like the label beside a painting in a museum: below it
        on phones; on wide screens beside it, its bottom edge level with the
        frame's (lg:items-end on the article).
      */}
      <div className="flex flex-col gap-3 rounded-sm bg-panel p-5 ring-1 ring-brass/60 sm:p-6 lg:col-span-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h3 id={titleId} className="text-[clamp(24px,2.6vw,30px)] leading-tight">
            {project.title}
          </h3>
          <p className="inline-flex items-center gap-2 rounded-full border border-aurora/60 px-3 py-0.5 text-sm text-aurora">
            {/* The dot is decoration; the words carry the status. */}
            <span aria-hidden="true" className="size-1.5 rounded-full bg-aurora" />
            <span className="sr-only">Status: </span>
            {STATUS_LABEL[project.status]}
          </p>
        </div>
        <p className="max-w-[40em] leading-relaxed text-haze">{project.summary}</p>
        <Medium project={project} className="text-sm leading-relaxed text-mist [&>span]:text-brass" />
        <ProjectLinks project={project} />
      </div>
    </article>
  );
}

/** A planned project: a pencil study on a dashed card, clearly labeled "Planned". */
function Study({ project }: { project: Project }) {
  const titleId = `project-${project.slug}-title`;
  return (
    <article
      aria-labelledby={titleId}
      data-kind="study"
      className="flex h-full flex-col gap-4 rounded-lg border border-dashed border-mist/50 p-4 sm:p-5"
    >
      <div className="rounded bg-panel/35">
        <StudySketch slug={project.slug} alt={project.artworkAlt} />
      </div>
      <div className="flex flex-col gap-2.5">
        <p className="text-xs font-medium tracking-[0.14em] text-mist uppercase">Study</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h3 id={titleId} className="text-2xl leading-tight text-haze italic">
            {project.title}
          </h3>
          {/* Dashed, like the card: an outline of a label, not a filled one. */}
          <p className="rounded-full border border-dashed border-mist px-3 py-0.5 text-sm text-mist">
            <span className="sr-only">Status: </span>
            {STATUS_LABEL[project.status]}
            {project.after && `, after ${titleOf(project.after)}`}
          </p>
        </div>
        <p className="leading-relaxed text-haze">{project.summary}</p>
        <Medium project={project} className="text-sm leading-relaxed text-mist" />
        <ProjectLinks project={project} />
      </div>
    </article>
  );
}

export default function Collection() {
  return (
    <section id="collection" aria-labelledby="collection-title" className="bg-night">
      <StringDivider />
      {/* page-container (globals.css): the same column as the header and footer, so their edges line up at every width. */}
      <div className="page-container flex flex-col gap-10 pt-12 pb-16 sm:pt-16 sm:pb-20">
        <div className="flex max-w-[44em] flex-col gap-3">
          <h2 id="collection-title" className="text-[clamp(30px,4vw,44px)] leading-tight">
            The Collection
          </h2>
          <p className="leading-relaxed text-haze">
            Three solo projects, each designed to measure what actually happens, predict with
            honest probabilities, score its own predictions, and learn from the results. Work in
            progress hangs framed; planned work is shown as studies.
          </p>
        </div>
        {/*
          One list in build order, so phones and screen readers get Aurora,
          Woodshed, Pigment. On wide screens each painting has a row to
          itself, with its placard beside it, and the studies sit two to a
          row below: on the wall, then in the sketchbook.
        */}
        <ul className="grid gap-10 lg:grid-cols-2 lg:gap-12">
          {PROJECTS.map((project) =>
            kindOf(project.status) === "painting" ? (
              <li key={project.slug} className="lg:col-span-2">
                <Painting project={project} />
              </li>
            ) : (
              <li key={project.slug}>
                <Study project={project} />
              </li>
            ),
          )}
        </ul>
      </div>
    </section>
  );
}
