import PaintedHero from "@/components/painter/PaintedHero";

// The page stays a Server Component. PaintedHero is a Client Component, and
// the heading and intro are passed to it as children, so they are rendered
// here on the server and arrive as HTML before any JavaScript runs.
export default function Home() {
  return (
    <main className="flex-1">
      <PaintedHero titleId="hero-title">
        {/* 9vw (at least 52px, at most 112px) as before, but never more than
            15% of the screen's height, so the name fits on a phone in
            landscape. 40px is the floor for very short screens. */}
        <h1
          id="hero-title"
          className="text-[clamp(40px,min(max(52px,9vw),15svh),112px)] leading-[0.95] font-normal tracking-[-0.02em]"
        >
          Harrison Min
        </h1>
        <p className="max-w-[34em] text-[clamp(16px,1.6vw,19px)] leading-[1.55] text-haze">
          Backend and data science, CS &amp; Math at Queens College. This canal is painted live
          in your browser, one brushstroke at a time.
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href="https://github.com/hmin6"
            className="inline-flex min-h-12 items-center rounded-full bg-aurora px-[22px] font-semibold text-night"
          >
            GitHub
          </a>
        </div>
      </PaintedHero>
    </main>
  );
}
