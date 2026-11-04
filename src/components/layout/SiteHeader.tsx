import { NAV } from "@/app/site";
import SiteNav from "./SiteNav";

/**
 * The site header: a solid night bar above the painting, not over it
 * (ADR-009). It scrolls away with the page rather than sticking.
 *
 * `overflow-x-clip` keeps a nav that's too wide (before the fit check in
 * SiteNav has run) from scrolling the page sideways, while still letting
 * the Menu panel hang below the header. `z-20` keeps that panel above the
 * hero's controls.
 */
export default function SiteHeader() {
  return (
    <header className="relative z-20 overflow-x-clip bg-night">
      <SiteNav items={NAV} />
    </header>
  );
}
