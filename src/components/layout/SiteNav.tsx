"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SITE, type NavItem } from "@/app/site";

/**
 * aria-current for a nav link. Hash links ("/#contact") are sections of the
 * home page, not pages, so they're only current through `section`: on a
 * case study under /work, the Work link is marked "true" (part of this
 * section). A plain page link is "page" on that exact page.
 */
function currentFor(item: NavItem, pathname: string): "page" | "true" | undefined {
  if (item.section && pathname.startsWith(item.section)) return "true";
  if (!item.href.includes("#") && pathname === item.href) return "page";
  return undefined;
}

const linkStyle =
  "inline-flex min-h-11 items-center rounded-full px-3 text-sm font-medium whitespace-nowrap text-haze hover:text-starlight aria-[current]:text-starlight aria-[current]:underline aria-[current]:decoration-brass aria-[current]:underline-offset-8";

/**
 * The header row: my name (the home link) and the main nav.
 *
 * The links sit inline whenever they fit on one line at the current width,
 * on phones too. Only when they don't fit does a Menu button replace them,
 * opening a panel with the same links (the disclosure pattern: a button with
 * aria-expanded that shows and hides a list, not an ARIA `menu`, which is
 * meant for app-style command menus).
 */
export default function SiteNav({ items }: { items: readonly NavItem[] }) {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  /** True when the inline links don't fit, so the Menu button shows instead. */
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState(false);
  // The panel only exists while collapsed: if the window widens and the
  // links fit again, it closes by itself.
  const menuOpen = open && collapsed;

  /*
   * Fit check. The inline list always stays in the page, even when
   * collapsed (then `invisible`, which also removes it from the Tab order
   * and from screen readers), so its links can still be measured. They
   * fit if their widths plus the gaps between them are no wider than the
   * nav, which fills the row beside my name. A ResizeObserver reruns this
   * when the nav resizes (window width) or the list does (web fonts
   * loading change the text width). It also fires once when it starts
   * observing, which does the first check.
   */
  useEffect(() => {
    const nav = navRef.current;
    const list = listRef.current;
    if (!nav || !list) return;
    const observer = new ResizeObserver(() => {
      const links = [...list.children];
      const gap = parseFloat(getComputedStyle(list).columnGap) || 0;
      const needed =
        links.reduce((sum, li) => sum + li.getBoundingClientRect().width, 0) +
        gap * Math.max(0, links.length - 1);
      setCollapsed(needed > nav.clientWidth + 0.5);
    });
    observer.observe(nav);
    observer.observe(list);
    return () => observer.disconnect();
  }, []);

  // While the panel is open: Escape closes it and returns focus to the
  // button, and so does a click or tap anywhere outside the nav.
  useEffect(() => {
    if (!menuOpen) return;
    const listeners = new AbortController();
    const { signal } = listeners;
    document.addEventListener(
      "keydown",
      (event) => {
        if (event.key !== "Escape") return;
        setOpen(false);
        buttonRef.current?.focus();
      },
      { signal },
    );
    document.addEventListener(
      "pointerdown",
      (event) => {
        if (!navRef.current?.contains(event.target as Node)) setOpen(false);
      },
      { signal },
    );
    return () => listeners.abort();
  }, [menuOpen]);

  const links = (onNavigate?: () => void) =>
    items.map((item) => (
      <li key={item.href} className="shrink-0">
        <Link href={item.href} aria-current={currentFor(item, pathname)} onClick={onNavigate} className={linkStyle}>
          {item.label}
        </Link>
      </li>
    ));

  return (
    <div className="flex h-(--header-h) items-center gap-4 px-[clamp(16px,4vw,48px)]">
      <Link
        href="/"
        aria-current={pathname === "/" ? "page" : undefined}
        className="inline-flex min-h-11 shrink-0 items-center rounded-full font-heading text-lg text-starlight"
      >
        {SITE.name}
      </Link>
      {/* min-w-0 lets the nav be narrower than its links, so the fit check can see they don't fit. */}
      <nav ref={navRef} aria-label="Main" className="relative flex min-w-0 flex-1 justify-end">
        <ul ref={listRef} className={`flex gap-1 ${collapsed ? "invisible absolute right-0" : ""}`}>
          {links()}
        </ul>
        {collapsed && (
          <>
            <button
              ref={buttonRef}
              type="button"
              aria-expanded={menuOpen}
              aria-controls="site-menu"
              onClick={() => setOpen(!menuOpen)}
              className="inline-flex min-h-11 min-w-11 cursor-pointer items-center rounded-full border border-starlight/80 px-4 text-sm font-medium text-starlight"
            >
              Menu
            </button>
            {/* Leaving the panel by Tab closes it, so it never hides the page behind it. */}
            <ul
              id="site-menu"
              hidden={!menuOpen}
              onBlur={(event) => {
                if (!navRef.current?.contains(event.relatedTarget as Node | null)) setOpen(false);
              }}
              className="absolute top-full right-0 mt-2 flex min-w-48 flex-col gap-1 rounded-2xl bg-panel p-2 ring-1 ring-line"
            >
              {links(() => setOpen(false))}
            </ul>
          </>
        )}
      </nav>
    </div>
  );
}
