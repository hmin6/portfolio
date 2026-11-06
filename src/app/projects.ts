/*
 * The projects shown in The Collection, in the order they're built. The
 * Collection, and later the liner notes pages, read only from here, so a
 * project's status, stack, and links change in one place.
 *
 * Facts only: summaries are worded as aims ("being built to", "will"), not as
 * finished features, and links stay empty until what they point to exists.
 */

/** Where a project is. Shown on its card as a written label, never by color alone. */
export type ProjectStatus = "in-progress" | "planned" | "finished";

/**
 * How a project hangs in The Collection: built and in-progress work as a
 * framed painting, planned work as a study (a sketch, visually unfinished).
 */
export type ProjectKind = "painting" | "study";

/**
 * A project's kind follows from its status instead of being stored next to
 * it, so the two can never disagree: a planned project can't be framed by
 * mistake, and moving Woodshed to "in-progress" frames it automatically.
 */
export function kindOf(status: ProjectStatus): ProjectKind {
  return status === "planned" ? "study" : "painting";
}

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  "in-progress": "In progress",
  planned: "Planned",
  finished: "Finished",
};

/** A template literal type: TypeScript rejects any string that doesn't start with https://. */
type HttpsUrl = `https://${string}`;

export interface Project {
  slug: "aurora" | "woodshed" | "pigment";
  title: string;
  status: ProjectStatus;
  /** For a planned project: the project it comes after. */
  after?: Project["slug"];
  /** One line, worded as an aim, not as a finished feature. */
  summary: string;
  medium: {
    items: readonly string[];
    /**
     * True while the list is the planned stack rather than the stack in use.
     * The placard then reads "Medium (draft):".
     */
    draft: boolean;
  };
  /** The artwork's text alternative. */
  artworkAlt: string;
  /**
   * Each link is filled in only once its target exists, and the card shows
   * only the links that are set. Until then there's nothing to link to, so
   * there's no link: no "coming soon" pages, no disabled buttons.
   */
  links: {
    /** The project's own site (any https URL, so a custom domain works later). */
    site?: HttpsUrl;
    /** Shown as "Source on GitHub". */
    repo?: HttpsUrl;
    /** The liner notes page, e.g. "/work/aurora", once it's written. */
    linerNotes?: `/work/${string}`;
  };
}

export const PROJECTS: readonly Project[] = [
  {
    slug: "aurora",
    title: "Aurora",
    status: "in-progress",
    summary:
      "Being built to tell people anywhere in the world whether tonight is worth going out to see the aurora, and to publicly prove how often it's right.",
    medium: {
      items: [
        "Python",
        "LightGBM",
        "PyTorch",
        "statsmodels",
        "lifelines",
        "Spring Boot",
        "PostgreSQL",
        "Next.js",
        "three.js",
        "GitHub Actions",
      ],
      // Still a draft: Aurora is in progress, but none of this is in use yet.
      // Once Aurora reaches its "First light" milestone, set draft to false
      // and trim the list to only what's actually in use, adding the rest
      // back as each layer ships.
      draft: true,
    },
    artworkAlt:
      "A painting of green and teal aurora curtains, fringed with violet, over a dark shoreline and still water under a starry sky.",
    // The site lives on its own vercel.app address once it's deployed; the
    // repo (hmin6/aurora) is added once it has code.
    links: {},
  },
  {
    slug: "woodshed",
    title: "Woodshed",
    status: "planned",
    after: "aurora",
    summary:
      "A practice coach for guitar and voice that will say what to practice today and predict what you're about to forget.",
    medium: {
      items: ["TypeScript", "Web Audio API", "Python", "Spring Boot", "PostgreSQL"],
      draft: true,
    },
    artworkAlt: "An unfinished pencil sketch of a guitar headstock beside a metronome.",
    links: {},
  },
  {
    slug: "pigment",
    title: "Pigment",
    status: "planned",
    after: "woodshed",
    summary: "A paint-mixing coach that will learn how your own paint tubes actually behave.",
    medium: {
      items: ["Python", "NumPy/SciPy", "OpenCV", "Spring Boot", "PostgreSQL", "Next.js"],
      draft: true,
    },
    artworkAlt: "An unfinished pencil sketch of a painter's palette with empty paint wells and a brush.",
    links: {},
  },
];

/** A project's title, for "Planned, after Aurora". */
export function titleOf(slug: Project["slug"]): string {
  return PROJECTS.find((p) => p.slug === slug)?.title ?? slug;
}
