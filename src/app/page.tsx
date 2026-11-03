// Temporary page that previews the design tokens from issue #3.
// The painted hero (#4) and the Collection (#8) will replace it.

const colors = [
  { name: "night", className: "bg-night", note: "Page background" },
  { name: "panel", className: "bg-panel", note: "Cards and raised surfaces" },
  { name: "deep", className: "bg-deep", note: "Scrims behind text over the hero" },
  { name: "line", className: "bg-line", note: "Borders and dividers" },
  { name: "starlight", className: "bg-starlight", note: "Primary text" },
  { name: "haze", className: "bg-haze", note: "Secondary text" },
  { name: "mist", className: "bg-mist", note: "Muted text: dates, labels" },
  { name: "aurora", className: "bg-aurora", note: "Primary accent, focus" },
  { name: "teal", className: "bg-teal", note: "Accent" },
  { name: "brass", className: "bg-brass", note: "Placards, string dividers" },
  { name: "magenta", className: "bg-magenta", note: "Sparing accent" },
  { name: "violet", className: "bg-violet", note: "Decorative only, never text" },
];

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-16">
      <h1 className="text-5xl font-semibold tracking-tight">Harrison Min</h1>
      <p className="mt-4 max-w-prose text-lg text-haze">
        Design tokens preview. Headings use Fraunces and body text uses Inter.
        This page is temporary until the painted hero arrives.
      </p>

      <section aria-labelledby="colors-heading" className="mt-12">
        <h2 id="colors-heading" className="text-2xl font-semibold">
          Colors
        </h2>
        <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {colors.map((color) => (
            <li
              key={color.name}
              className="overflow-hidden rounded-lg border border-line bg-panel"
            >
              {/* Swatches are decorative; the name and note carry the meaning. */}
              <div aria-hidden="true" className={`h-16 ${color.className}`} />
              <div className="p-3">
                <p className="font-medium">{color.name}</p>
                <p className="text-sm text-mist">{color.note}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="type-heading" className="mt-12">
        <h2 id="type-heading" className="text-2xl font-semibold">
          Type and states
        </h2>
        <div className="mt-6 rounded-lg border border-line bg-deep/80 p-6">
          <h3 className="text-3xl">A canal under the aurora</h3>
          <p className="mt-2 text-haze">
            Secondary text in haze, on a deep scrim at 80% opacity.
          </p>
          <p className="mt-1 text-sm text-mist">Caption in mist, November 2026</p>
          <a
            href="#colors-heading"
            className="mt-4 inline-block rounded border border-current bg-transparent px-4 py-2 text-aurora"
          >
            Tab here to see the focus ring
          </a>
        </div>
      </section>
    </main>
  );
}
