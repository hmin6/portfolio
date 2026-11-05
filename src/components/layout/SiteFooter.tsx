import { SITE } from "@/app/site";
import StringDivider from "./StringDivider";

const linkStyle =
  "inline-flex min-h-11 items-center rounded-full text-starlight underline decoration-starlight/40 underline-offset-4 hover:decoration-brass";

/**
 * The site footer, on every page: how to reach me, what the site is built
 * with, and the copyright line. `id="contact"` is the target of the nav's
 * Contact link. Plain links, no new tabs: the browser's back button
 * returns here.
 */
export default function SiteFooter() {
  return (
    <footer id="contact" className="bg-night">
      <StringDivider />
      <div className="flex flex-col gap-8 px-[clamp(16px,4vw,48px)] pt-10 pb-12 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl">Contact</h2>
          <ul className="flex flex-col sm:flex-row sm:flex-wrap sm:gap-x-6">
            <li>
              <a href={`mailto:${SITE.email}`} className={linkStyle}>
                {SITE.email}
              </a>
            </li>
            <li>
              <a href={SITE.github} className={linkStyle}>
                GitHub
              </a>
            </li>
            <li>
              <a href={SITE.linkedin} className={linkStyle}>
                LinkedIn
              </a>
            </li>
          </ul>
        </div>
        <div className="flex max-w-[34em] flex-col gap-2 text-sm text-mist sm:text-right">
          <p>
            Built with Next.js, TypeScript, and Tailwind CSS. The canal is painted live in your
            browser with Canvas 2D.
          </p>
          <p>
            © {SITE.copyrightYear} {SITE.name}
          </p>
        </div>
      </div>
    </footer>
  );
}
