/*
 * Site-wide details: who this is, how to reach me, and what the nav links
 * to. The header, footer, and hero read these, so a link changes in one place.
 */

export const SITE = {
  name: "Harrison Min",
  email: "harrisonmin123@gmail.com",
  github: "https://github.com/hmin6",
  linkedin: "https://www.linkedin.com/in/harrisonmin",
  /**
   * The copyright year. A constant rather than `new Date().getFullYear()`:
   * with Cache Components, reading the clock while prerendering fails the
   * build (the page is rendered once at build time, so "now" isn't known).
   * Update it each January.
   */
  copyrightYear: 2026,
} as const;

export interface NavItem {
  label: string;
  href: string;
  /**
   * Path prefix of pages that belong to this item. On those pages the link
   * gets aria-current, e.g. "/work" for a case study under /work/aurora.
   */
  section?: string;
}

/**
 * The main nav. Only sections that exist are listed, so nothing links to a
 * missing anchor:
 * - Work is the Collection (#8). `section: "/work"` marks it current on
 *   liner notes pages, which live under /work.
 * - About ("/#about") is added by #9, between Work and Contact.
 */
export const NAV: readonly NavItem[] = [
  { label: "Work", href: "/#collection", section: "/work" },
  { label: "Contact", href: "/#contact" },
];
