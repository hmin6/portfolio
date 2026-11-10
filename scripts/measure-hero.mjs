/**
 * Measures the homepage hero in a headless browser: text contrast over the
 * painting, focus-ring and pill-edge contrast, layout on phones, Night-mode
 * edge contrast, and (optionally) what happens on rotation and on a slow phone.
 *
 * Usage:
 *   npm run build && npm run start         # in one terminal (a production build,
 *                                          # so the dev-tools badge isn't measured)
 *   npm run measure:hero                   # in another
 *   npm run measure:hero -- --rotation --perf --label after
 *
 * Options:
 *   --url <url>      page to measure (default http://localhost:3000/)
 *   --label <name>   prefix for the screenshots and report (default "run")
 *   --only a,b       only these viewports, by name (see VIEWPORTS)
 *   --no-modes       skip the per-mode contrast pass
 *   --rotation       also run the rotation test (running, paused, reduced motion)
 *   --perf           also run the 4x CPU-throttled phone check
 *   --still          also run the still-frame checks (#6): with reduced motion
 *                    or Pause motion, the painting never fills in or moves
 *   --page           also run the shared-layout checks (#7): landmarks, the
 *                    nav (inline or Menu), skip link, full-page Tab order,
 *                    string dividers, and the hero's fade into the page;
 *                    and the Collection (#8): its structure, labels, links,
 *                    and screenshots, and the Work link reaching it; and
 *                    About (#9): its place, heading, groups, screenshots,
 *                    and the About link reaching it
 *   --readme-shot    only retake the README's screenshot (#32): the Night hero
 *                    at 1440×900 as a finished still, saved to
 *                    docs/images/hero-night.webp, then exit
 *
 * Output goes to hero-measurements/ (git-ignored): one screenshot per viewport
 * and mode, rotation frames, and <label>-report.json. A summary is printed at
 * the end, with * marking any value below the pass bars in ADR-007.
 *
 * How it measures:
 * - Text: for each mode, the script hides the text and screenshots what is
 *   behind it, then computes the WCAG contrast ratio of the text color
 *   against every pixel under each line of text. It reports the lightest 1%
 *   ("p1", the pass bar) and the single lightest pixel ("min"). The painting
 *   moves, so each mode is sampled twice and the worse value kept.
 * - Focus ring: it pauses the painting, Tabs to each control (real keyboard
 *   focus), and compares screenshots with and without the ring. The ring's
 *   best color must reach 3:1 against the painting just outside it.
 * - Pill edges: the light border or the dark ring outside it must reach 3:1
 *   against the painting 3.5px out. Pills are the hero's chip buttons and
 *   any hero link with a border (the Resume outline link, #13).
 * - Links: the row under the intro must stay inside the hero's padding with
 *   at least 12px between links, and every hero button and link must have
 *   had its focus ring measured.
 * - Still frames: stroke() calls on canvases in the page are counted per
 *   frame (an off-screen still's strokes are counted separately), drawImage
 *   onto the paint canvas marks a still being swapped in, and the canvases
 *   are hashed every 50 ms to count how many distinct states a visitor saw.
 *
 * Needs Node 22+ (for the global WebSocket) and Chrome or Edge. Set
 * BROWSER_PATH if the browser isn't found. No npm dependencies: it speaks the
 * Chrome DevTools Protocol directly.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";

const { values: args } = parseArgs({
  options: {
    url: { type: "string", default: "http://localhost:3000/" },
    label: { type: "string", default: "run" },
    only: { type: "string" },
    "no-modes": { type: "boolean", default: false },
    rotation: { type: "boolean", default: false },
    perf: { type: "boolean", default: false },
    still: { type: "boolean", default: false },
    page: { type: "boolean", default: false },
    "readme-shot": { type: "boolean", default: false },
  },
});

const OUT_DIR = "hero-measurements";
/*
 * The page has more than one <section> (the hero, then the Collection), so
 * every hero measurement finds the hero by its label, written in the browser
 * as [aria-labelledby=hero-title], never as a bare "section".
 */
const PORT = 9333;

/** Pass bars (ADR-007). */
const TEXT_MIN = 4.5;
const NON_TEXT_MIN = 3;

/**
 * Desktops: 1440 (the widest the content column gets, see page-container in
 * globals.css), and two wider monitors (#29), where the column is centered
 * and the hero's text and controls move in from the screen edge with it.
 *
 * The phone sizes: a Galaxy S25 Ultra at its default FHD+ resolution
 * (1080×2340 at 2.625 device pixels per CSS pixel), an iPhone SE, and the
 * narrowest common width.
 */
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900, dpr: 1, mobile: false },
  { name: "desktop-1920", width: 1920, height: 1080, dpr: 1, mobile: false },
  { name: "desktop-2560", width: 2560, height: 1440, dpr: 1, mobile: false },
  { name: "phone", width: 412, height: 892, dpr: 2.625, mobile: true },
  { name: "phone-landscape", width: 892, height: 412, dpr: 2.625, mobile: true },
  { name: "se", width: 375, height: 667, dpr: 2, mobile: true },
  { name: "narrow", width: 320, height: 568, dpr: 2, mobile: true },
];
const MODES = [
  { label: "Night", slug: "night" },
  { label: "Golden hour", slug: "golden" },
  { label: "Day", slug: "day" },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/*
 * Timeouts, so a stuck run fails with a message instead of hanging. A run
 * during #8 sat for over two hours on one step.
 *
 * Every wait in this script is either sleep() (which always ends) or a
 * DevTools command waiting for the browser's answer, so a hang means a
 * command that never got one. Two limits:
 *
 * - COMMAND_TIMEOUT_MS, 30 s, for each command. The longest a command is
 *   meant to take is 15 s: WAIT_FOR_SWAP waits up to 15 s in the page for a
 *   still frame. Measured with every option on (#8), the slowest command
 *   took 2.2 s (a phone screenshot, and an evaluate in the still checks).
 *   30 s is twice the designed maximum, so a slower machine doesn't trip
 *   it, and a real hang fails within half a minute instead of hours.
 * - STEP_TIMEOUT_MS, 5 minutes, for each step (one viewport's contrast
 *   pass, one viewport's page checks, the still-frame checks, ...). A
 *   backstop for a step that keeps getting answers but never finishes, for
 *   example a loop waiting for something that never happens. Measured, the
 *   slowest step took 116 s ("contrast phone"); the others took 13–107 s.
 *   5 minutes is about 2.5 times the slowest, room for a slower machine.
 *   It doesn't need to be tight: a stuck command is caught at 30 s.
 *
 * A timeout names the step (and the part of it) that was running, writes
 * what was measured so far to the report, and exits with code 1. Each
 * step's duration and the slowest command are in the report under
 * `timing`, so the limits can be checked against real runs.
 */
const COMMAND_TIMEOUT_MS = 30_000;
const STEP_TIMEOUT_MS = 300_000;
/** For opening the connection to the browser. */
const CONNECT_TIMEOUT_MS = 10_000;

/** The step running now, and which part of it, for timeout messages. */
const where = { step: "starting the browser", detail: "" };
const describeWhere = () => `step "${where.step}"${where.detail ? ` (${where.detail})` : ""}`;
/** Sets which part of the current step is running. */
const note = (detail) => {
  where.detail = detail;
};

/** How long each step took, and the slowest single command, in ms. */
const timing = { steps: {}, slowestCommand: null };

/** Runs one step, failing it if it takes longer than `budget` ms. */
async function step(name, fn, budget = STEP_TIMEOUT_MS) {
  where.step = name;
  where.detail = "";
  const started = performance.now();
  let timer;
  const overBudget = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out: ${describeWhere()} took longer than ${budget / 1000} s.`)), budget);
  });
  try {
    return await Promise.race([fn(), overBudget]);
  } finally {
    clearTimeout(timer);
    timing.steps[name] = Math.round(performance.now() - started);
  }
}

function findBrowser() {
  const candidates = [
    process.env.BROWSER_PATH,
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/microsoft-edge",
  ];
  const found = candidates.find((path) => path && existsSync(path));
  if (!found) throw new Error("No Chrome or Edge found. Set BROWSER_PATH.");
  return found;
}

/** Launches the browser and returns a minimal CDP client for its first tab. */
async function connect() {
  const profile = mkdtempSync(join(tmpdir(), "measure-hero-"));
  const browser = spawn(findBrowser(), [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--disable-extensions",
    "about:blank",
  ]);

  let wsUrl;
  for (let i = 0; i < 50 && !wsUrl; i++) {
    await sleep(200);
    try {
      const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      wsUrl = targets.find((t) => t.type === "page")?.webSocketDebuggerUrl;
    } catch {
      // Not listening yet.
    }
  }
  if (!wsUrl) throw new Error("The browser didn't open a debugging port.");

  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out: the browser's debugging connection didn't open within ${CONNECT_TIMEOUT_MS / 1000} s.`)), CONNECT_TIMEOUT_MS);
    ws.addEventListener("open", () => {
      clearTimeout(timer);
      resolve();
    });
  });
  let nextId = 1;
  const pending = new Map();
  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    const waiter = msg.id && pending.get(msg.id);
    if (!waiter) return;
    pending.delete(msg.id);
    if (msg.error) waiter.reject(new Error(msg.error.message));
    else waiter.resolve(msg.result);
  });
  // If the browser crashes or closes, fail every waiting command now
  // instead of letting each one run out its timeout.
  ws.addEventListener("close", () => {
    for (const waiter of pending.values()) waiter.reject(new Error(`The browser connection closed during ${describeWhere()}.`));
    pending.clear();
  });

  /**
   * Sends a DevTools command and waits for the answer, for at most
   * COMMAND_TIMEOUT_MS. Also records the slowest command of the run.
   */
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      const started = performance.now();
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Timed out: ${method} got no answer from the browser within ${COMMAND_TIMEOUT_MS / 1000} s, during ${describeWhere()}.`));
      }, COMMAND_TIMEOUT_MS);
      pending.set(id, {
        resolve: (result) => {
          clearTimeout(timer);
          const ms = Math.round(performance.now() - started);
          if (!timing.slowestCommand || ms > timing.slowestCommand.ms) {
            timing.slowestCommand = { method, ms, during: describeWhere() };
          }
          resolve(result);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description ?? "evaluate failed");
    }
    return result.result.value;
  };
  const close = () => {
    ws.close();
    browser.kill();
    // The browser may hold the profile briefly after exit.
    setTimeout(() => rmSync(profile, { recursive: true, force: true }), 500);
  };
  await send("Page.enable");
  await send("Runtime.enable");
  return { send, evaluate, close };
}

/*
 * In-page code. These are strings sent to the browser with Runtime.evaluate.
 */

/** WCAG relative luminance and contrast, plus helpers, defined once per page. */
const PAGE_HELPERS = String.raw`
window.__m = {
  lum(r, g, b) {
    const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  },
  ratio(a, b) { return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); },
  cssLum(css) { const [r, g, b] = css.match(/[\d.]+/g).map(Number); return __m.lum(r, g, b); },
  stats(values) {
    if (!values.length) return null;
    values.sort((a, b) => a - b);
    const q = (p) => +values[Math.min(values.length - 1, Math.floor(p * values.length))].toFixed(2);
    return { min: q(0), p1: q(0.01), median: q(0.5) };
  },
  async decode(png) {
    const img = new Image();
    img.src = "data:image/png;base64," + png;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext("2d");
    g.drawImage(img, 0, 0);
    const data = g.getImageData(0, 0, c.width, c.height).data;
    return {
      width: c.width, height: c.height,
      lumAt(x, y) {
        // A device pixel covers [x, x + 1), so floor, not round.
        x = Math.max(0, Math.min(c.width - 1, Math.floor(x)));
        y = Math.max(0, Math.min(c.height - 1, Math.floor(y)));
        const i = (y * c.width + x) * 4;
        return __m.lum(data[i], data[i + 1], data[i + 2]);
      },
    };
  },
  textRects(el) {
    const range = document.createRange();
    range.selectNodeContents(el);
    return [...range.getClientRects()];
  },
  /** Every button and link in the hero. */
  controls() { return [...document.querySelectorAll("[aria-labelledby=hero-title] :is(button, a)")]; },
  /**
   * The pills with their own edge: buttons outside the Time of day group,
   * and links with a border, like the Resume outline link (#13). The
   * GitHub button is a solid fill with no border, so it isn't one.
   */
  chips() {
    return __m.controls().filter((el) =>
      el.matches("button") ? !el.closest('[role="group"]') : parseFloat(getComputedStyle(el).borderTopWidth) > 0,
    );
  },
};`;

/**
 * Hides text (not pills) so a screenshot shows what is behind it. The
 * heading and intro go entirely. Buttons and links keep their fill and edge
 * and lose only their text, so a pill's text is measured against the pill
 * (and whatever shows through it), and its edge against the painting.
 */
const HIDE_TEXT = `(() => {
  const s = document.createElement("style");
  s.id = "__hide";
  s.textContent = "h1, h1 + p { visibility: hidden !important } [aria-labelledby=hero-title] :is(button, a) { color: transparent !important }";
  document.head.append(s);
})()`;
const SHOW_TEXT = `document.getElementById("__hide")?.remove()`;

/**
 * Hides the focus ring but keeps any Tailwind ring-* edge: box-shadow is
 * rebuilt from Tailwind's shadow variables minus --tw-shadow, which is where
 * shadow-focus goes. Elements without those variables get no shadow.
 */
const HIDE_RING = `(() => {
  const s = document.createElement("style");
  s.id = "__ring";
  s.textContent = ":focus-visible { outline: none !important; box-shadow: var(--tw-inset-shadow, 0 0 #0000), var(--tw-inset-ring-shadow, 0 0 #0000), var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000) !important }";
  document.head.append(s);
})()`;
const SHOW_RING = `document.getElementById("__ring")?.remove()`;

/**
 * Measures one screenshot (taken with the text hidden). Called as
 * ANALYZE(png, dpr). All boxes come from the live page, in CSS pixels.
 */
const ANALYZE = String.raw`async (png, dpr) => {
  const img = await __m.decode(png);
  const { ratio, cssLum, stats } = __m;
  const sampleText = (el) => {
    const textLum = cssLum(getComputedStyle(el).color);
    const out = [];
    for (const r of __m.textRects(el)) {
      for (let y = Math.floor(r.top * dpr); y < Math.ceil(r.bottom * dpr); y++) {
        if (y < 0 || y >= img.height) continue;
        for (let x = Math.floor(r.left * dpr); x < Math.ceil(r.right * dpr); x++) {
          if (x >= 0 && x < img.width) out.push(ratio(textLum, img.lumAt(x, y)));
        }
      }
    }
    return out;
  };

  const result = {
    heading: stats(sampleText(document.querySelector("h1"))),
    intro: stats(sampleText(document.querySelector("h1 + p"))),
    chipText: {},
    edge: {},
  };

  // Text on the pills and links. The screenshot has their text hidden, so
  // this is each one's own fill (including whatever shows through it).
  for (const el of __m.controls()) {
    result.chipText[el.textContent.trim()] = stats(sampleText(el));
  }

  // Pill edge: the light border (just inside the edge) or the dark ring
  // (just outside it), whichever contrasts more with the painting 3.5 px
  // out. Every device-pixel row within 1.5 px of the edge is checked and
  // the best one kept, so rows that are only partly border (anti-aliasing
  // at fractional pixel ratios) don't hide the solid ones.
  const edge = (rect) => {
    const out = [];
    const inset = rect.height / 2;
    for (let x = rect.left + inset; x < rect.right - inset; x += 1 / dpr) {
      for (const [edgeY, dir] of [[rect.top, -1], [rect.bottom, 1]]) {
        const outside = img.lumAt(x * dpr, (edgeY + dir * 3.5) * dpr);
        let best = 1;
        for (let d = -1.5; d <= 1.5; d += 1 / dpr) {
          best = Math.max(best, ratio(img.lumAt(x * dpr, (edgeY + dir * d) * dpr), outside));
        }
        out.push(best);
      }
    }
    return out;
  };
  for (const chip of __m.chips()) result.edge[chip.textContent.trim()] = stats(edge(chip.getBoundingClientRect()));
  result.edge["Time of day group"] = stats(edge(document.querySelector('[role="group"]').getBoundingClientRect()));
  return result;
}`;

/**
 * Focus ring of the focused element, from two screenshots of a paused
 * painting: one with nothing focused, one with the element focused. Ring
 * pixels are the ones that changed. Walking outward from the element's top
 * and bottom edges, the best ring pixel must reach 3:1 against the painting
 * just past the ring. Called as RING(plainPng, focusedPng, dpr).
 */
const RING = String.raw`async (plainPng, focusedPng, dpr) => {
  const plain = await __m.decode(plainPng);
  const focused = await __m.decode(focusedPng);
  const { ratio, stats } = __m;
  const rect = document.activeElement.getBoundingClientRect();
  const out = [];
  const inset = Math.min(rect.width / 3, rect.height / 2);
  for (let x = rect.left + inset; x < rect.right - inset; x += 1 / dpr) {
    for (const [edgeY, dir] of [[rect.top, -1], [rect.bottom, 1]]) {
      const ring = [];
      let outer = -1;
      for (let d = 0; d <= 10; d += 1 / dpr) {
        const y = (edgeY + dir * d) * dpr;
        const after = focused.lumAt(x * dpr, y);
        if (ratio(plain.lumAt(x * dpr, y), after) > 1.1) {
          ring.push(after);
          outer = d;
        }
      }
      if (outer < 0) { out.push(1); continue; }
      const bg = plain.lumAt(x * dpr, (edgeY + dir * (outer + 2)) * dpr);
      out.push(Math.max(...ring.map((l) => ratio(l, bg))));
    }
  }
  return stats(out);
}`;

/**
 * Night-mode readability: how much the buildings and the gondola stand out
 * from what is behind them, as a luminance ratio between bands on either
 * side of their outline. Decorative, so there's no WCAG bar; compare runs.
 * The geometry mirrors createViewport and createLayout in layout.ts.
 */
const NIGHT_EDGES = String.raw`async (png, dpr) => {
  const img = await __m.decode(png);
  const { ratio, stats } = __m;
  const hero = document.querySelector("[aria-labelledby=hero-title]").getBoundingClientRect();
  const W = hero.width, H = hero.height;
  const SW = W < 700 ? 220 : 360;
  const SH = Math.max(120, Math.round((SW * H) / W));
  const wide = SW / SH > 1.3;
  const tall = SW / SH < 0.8;
  // Points under the controls or the text block measure those, not the
  // painting, so they are skipped (box returns NaN, filtered out below).
  const covers = [...document.querySelectorAll('[aria-labelledby=hero-title] button, [role="group"], h1, h1 + p, [aria-labelledby=hero-title] a')]
    .map((el) => el.getBoundingClientRect());
  const covered = (x, y) => covers.some((c) => x + hero.left > c.left - 8 && x + hero.left < c.right + 8 && y + hero.top > c.top - 8 && y + hero.top < c.bottom + 8);
  // Average luminance in a small box, to smooth over single brushstrokes.
  const box = (cx, cy, r) => {
    if (covered(cx, cy)) return NaN;
    let sum = 0, n = 0;
    for (let y = cy - r; y <= cy + r; y += 1) for (let x = cx - r; x <= cx + r; x += 1) {
      sum += img.lumAt((hero.left + x) * dpr, (hero.top + y) * dpr); n++;
    }
    return sum / n;
  };
  const r = Math.max(1, W * 0.0025);

  // Canal-facing walls against the sky beside them. The wall sample sits in
  // the strip between the last column of windows and the edge.
  const walls = [];
  const leftEdge = W * (wide ? 0.2 : 0.26);
  const rightEdge = W * (1 - (wide ? 0.17 : 0.22));
  const inside = W * 0.008;
  const outside = W * 0.02;
  for (let y = H * 0.25; y < H * 0.45; y += 2) {
    walls.push(ratio(box(leftEdge - inside, y, r), box(leftEdge + outside, y, r)));
    walls.push(ratio(box(rightEdge + inside, y, r), box(rightEdge - outside, y, r)));
  }
  // Rooflines against the sky above, away from chimneys and the roof cap.
  const roofs = [];
  for (let x = leftEdge * 0.86; x < leftEdge * 0.97; x += 2) {
    roofs.push(ratio(box(x, H * 0.14 + H * 0.03, r), box(x, H * 0.14 - H * 0.06, r)));
  }
  for (let x = rightEdge + (W - rightEdge) * 0.03; x < rightEdge + (W - rightEdge) * 0.15; x += 2) {
    roofs.push(ratio(box(x, H * 0.22 + H * 0.03, r), box(x, H * 0.22 - H * 0.06, r)));
  }
  // Gondola hull against the water just above it.
  const L = W * (wide ? 0.22 : 0.34);
  const gx = W * (wide ? 0.58 : 0.52);
  const gy = H * (tall ? 0.6 : 0.75);
  const hull = [];
  for (let x = gx - L * 0.25; x < gx + L * 0.25; x += 2) {
    hull.push(ratio(box(x, gy + L * 0.01, 1), box(x, gy - L * 0.08, 1)));
  }
  const clean = (values) => stats(values.filter((v) => Number.isFinite(v)));
  return { walls: clean(walls), roofs: clean(roofs), hull: clean(hull) };
}`;

const LAYOUT = String.raw`(() => {
  const rect = (el) => el.getBoundingClientRect();
  const h1 = rect(document.querySelector("h1"));
  const links = [...document.querySelectorAll("[aria-labelledby=hero-title] a")];
  const controls = __m.controls();
  const controlsBottom = Math.max(...[...document.querySelectorAll("[aria-labelledby=hero-title] button")].map((b) => rect(b).bottom));
  const small = controls
    .map((el) => ({ name: el.textContent.trim(), w: rect(el).width, h: rect(el).height }))
    .filter((c) => c.w < 44 || c.h < 44)
    .map((c) => c.name + " " + Math.round(c.w) + "x" + Math.round(c.h));
  const hero = rect(document.querySelector("[aria-labelledby=hero-title]"));
  // Every visible link and button on the page (header, hero, footer). The
  // skip link is left out while it's hidden (1x1 until focused).
  const pageSmall = [...document.querySelectorAll("a, button")]
    .filter((el) => el.checkVisibility({ visibilityProperty: true }) && rect(el).width > 1)
    .map((el) => ({ name: el.textContent.trim(), w: rect(el).width, h: rect(el).height }))
    .filter((c) => c.w < 44 || c.h < 44)
    .map((c) => c.name + " " + Math.round(c.w) + "x" + Math.round(c.h));

  // Alignment with the content column (#29). The column's content edges are
  // the header row's (a page-container) minus its padding. The text block
  // sits sm:ml-[clamp(4px,1vw,16px)] inside the left edge (0 below sm,
  // 640px), and the controls end on the right edge. vw counts the
  // scrollbar, and so does innerWidth.
  const column = document.querySelector("header .page-container");
  const cs = getComputedStyle(column);
  const colLeft = rect(column).left + parseFloat(cs.paddingLeft);
  const colRight = rect(column).right - parseFloat(cs.paddingRight);
  const textBlock = rect(document.querySelector("h1").parentElement);
  const buttons = [...document.querySelectorAll("[aria-labelledby=hero-title] button")];
  const controlsRight = Math.max(...buttons.map((b) => rect(b).right), rect(document.querySelector('[role="group"]')).right);
  const round = (v) => Math.round(v * 10) / 10;
  const expectedTextInset = innerWidth >= 640 ? Math.min(16, Math.max(4, innerWidth / 100)) : 0;
  const textLeftInset = round(textBlock.left - colLeft);
  const controlsRightInset = round(colRight - controlsRight);
  // Positions of the text and controls, to compare runs (nothing should move
  // at 1440 and below).
  const box = (el) => { const r = rect(el); return [r.left, r.top, r.width, r.height].map(round); };
  const positions = { heading: box(document.querySelector("h1")), intro: box(document.querySelector("h1 + p")) };
  for (const el of controls) positions[el.textContent.trim()] = box(el);

  // The row of links under the intro (GitHub, Resume): whether it's one
  // line, the smallest space between two neighbors (beside each other on a
  // line, or between lines if it wraps), and whether every link stays
  // inside the hero's padding. "Not crowded" is a gap of at least 12px,
  // the row's gap-3, and nothing past the padding.
  const heroEl = document.querySelector("[aria-labelledby=hero-title]");
  const contentRight = hero.right - parseFloat(getComputedStyle(heroEl).paddingRight);
  const lr = links.map(rect);
  const lineTops = new Set(lr.map((r) => Math.round(r.top)));
  let minGap = null;
  for (let i = 1; i < lr.length; i++) {
    const a = lr[i - 1], b = lr[i];
    const gap = Math.round(b.top) === Math.round(a.top) ? b.left - a.right : b.top - a.bottom;
    minGap = minGap === null ? gap : Math.min(minGap, gap);
  }
  const insidePadding = lr.every((r) => r.right <= contentRight + 0.5);
  const linkRow = {
    links: links.map((a) => a.textContent.trim()),
    lines: lineTops.size,
    minGap: minGap === null ? null : round(minGap),
    rightmost: round(Math.max(...lr.map((r) => r.right))),
    contentRight: round(contentRight),
    ok: insidePadding && (minGap === null || minGap >= 11.5),
  };
  return {
    alignment: {
      columnLeft: round(colLeft),
      columnRight: round(colRight),
      textLeftInset,
      expectedTextInset: round(expectedTextInset),
      controlsRightInset,
      ok: Math.abs(textLeftInset - expectedTextInset) < 0.5 && Math.abs(controlsRightInset) < 0.5,
    },
    positions,
    linkRow,
    horizontalScroll: document.documentElement.scrollWidth > innerWidth,
    gapControlsToHeading: Math.round(h1.top - controlsBottom),
    targetsUnder44: [...new Set([...small, ...pageSmall])],
    headingFitsFirstScreen: h1.bottom <= innerHeight,
    linkFitsFirstScreen: Math.max(...lr.map((r) => r.bottom)) <= innerHeight,
    heroHeight: Math.round(hero.height),
  };
})()`;

/*
 * Instrumentation, installed before the page loads:
 * - __frames: per animation frame, its timestamp and the stroke() calls on
 *   canvases in the page (what a visitor can see being painted). Strokes on
 *   detached canvases, like an off-screen still, aren't counted here.
 * - __counts: running totals of stroke() calls, visible and off screen.
 * - __events: drawImage calls on the visible paint canvas. A 3-argument
 *   drawImage of a whole canvas is a still being swapped in ("swap"); the
 *   5-argument one is the stretched copy after a resize ("stretch").
 * - __longTasks: main-thread tasks over 50 ms.
 */
const INSTRUMENT = String.raw`
(() => {
  window.__frames = [];
  window.__counts = { visible: 0, offscreen: 0 };
  window.__events = [];
  window.__longTasks = [];
  let strokes = 0;
  const proto = CanvasRenderingContext2D.prototype;
  const stroke = proto.stroke;
  proto.stroke = function (...a) {
    if (this.canvas.isConnected) { strokes++; window.__counts.visible++; }
    else window.__counts.offscreen++;
    return stroke.apply(this, a);
  };
  const drawImage = proto.drawImage;
  proto.drawImage = function (...a) {
    if (this.canvas.isConnected && this.canvas.getAttribute("role") === "img") {
      window.__events.push({ t: performance.now(), kind: a.length === 3 ? "swap" : "stretch" });
    }
    return drawImage.apply(this, a);
  };
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf((ts) => {
    window.__frames.push({ ts, strokes });
    strokes = 0;
    cb(ts);
  });
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__longTasks.push({ t: e.startTime, ms: e.duration });
    }).observe({ type: "longtask", buffered: true });
  } catch {}
})();`;

/**
 * A hash of the visible paint and light canvases at full resolution, to
 * tell whether anything on screen changed.
 *
 * Take one throwaway reading first. After the first getImageData, Chrome
 * may move a canvas from the GPU into regular memory, and the light layer's
 * faint, semi-transparent glows can then read back a step different even
 * though nothing was drawn. Screenshots (what the visitor sees) don't change.
 */
const SNAP = String.raw`(() => {
  let h = 2166136261;
  for (const c of document.querySelectorAll("[aria-labelledby=hero-title] canvas")) {
    const d = new Uint32Array(c.getContext("2d").getImageData(0, 0, c.width, c.height).data.buffer);
    for (let i = 0; i < d.length; i++) h = Math.imul(h ^ d[i], 16777619);
  }
  return h >>> 0;
})()`;

/** Where two screenshots differ: changed pixels, the largest channel difference, and the bounding box in CSS pixels. */
const SHOT_DIFF = String.raw`async (a, b, dpr) => {
  const load = async (s) => { const img = new Image(); img.src = "data:image/png;base64," + s; await img.decode(); return img; };
  const [A, B] = await Promise.all([load(a), load(b)]);
  const c = document.createElement("canvas");
  c.width = A.width; c.height = A.height;
  const x = c.getContext("2d");
  x.drawImage(A, 0, 0); const da = x.getImageData(0, 0, c.width, c.height).data;
  x.drawImage(B, 0, 0); const db = x.getImageData(0, 0, c.width, c.height).data;
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1, n = 0, maxDiff = 0;
  for (let i = 0; i < da.length; i += 4) {
    const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]));
    if (!d) continue;
    const p = i / 4, px = p % c.width, py = (p / c.width) | 0;
    n++; maxDiff = Math.max(maxDiff, d);
    x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
  }
  return { changed: n, maxDiff, box: n ? [x0, y0, x1, y1].map((v) => Math.round(v / dpr)) : null };
}`;

/** Saves the paint canvas's pixels, so DIFF_BOX can compare against them later. */
const SAVE_PAINT = String.raw`(() => {
  const c = document.querySelector("[aria-labelledby=hero-title] canvas");
  window.__saved = c.getContext("2d").getImageData(0, 0, c.width, c.height).data.slice();
})()`;

/** Bounding box (device pixels) of every paint-canvas pixel that changed since SAVE_PAINT. */
const DIFF_BOX = String.raw`(() => {
  const c = document.querySelector("[aria-labelledby=hero-title] canvas");
  const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
  const s = window.__saved;
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1, n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] !== s[i] || d[i + 1] !== s[i + 1] || d[i + 2] !== s[i + 2]) {
      const p = i / 4, x = p % c.width, y = (p / c.width) | 0;
      n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  return n ? { changed: n, width: x1 - x0 + 1, height: y1 - y0 + 1, share: +(n / (d.length / 4)).toFixed(4) } : { changed: 0 };
})()`;

/**
 * Samples SNAP every 50 ms (on a timer, not requestAnimationFrame, so it
 * doesn't count as a frame) and keeps the list of distinct states in order.
 * An off-screen still shows up as exactly one change; a canvas filling in
 * shows up as many.
 */
const START_SAMPLER = String.raw`(() => {
  const snap = () => ${SNAP};
  snap();
  window.__states = [snap()];
  window.__sampler = setInterval(() => {
    const h = snap();
    if (h !== window.__states.at(-1)) window.__states.push(h);
  }, 50);
})()`;
const STOP_SAMPLER = String.raw`(() => { clearInterval(window.__sampler); return window.__states.length; })()`;

/** Resolves when a still is swapped in after `since` (ms), or null after `timeout` ms. */
const WAIT_FOR_SWAP = String.raw`(since, timeout) => new Promise((resolve) => {
  const start = performance.now();
  const check = () => {
    const swap = window.__events.find((e) => e.kind === "swap" && e.t > since);
    if (swap) resolve(swap.t);
    else if (performance.now() - start > timeout) resolve(null);
    else setTimeout(check, 20);
  };
  check();
})`;

/** Share of the visible paint canvas still showing the bare Night underpaint. */
const UNDERPAINT_SHARE = String.raw`(() => {
  const c = document.querySelector("[aria-labelledby=hero-title] canvas");
  const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (Math.abs(d[i] - 46) < 8 && Math.abs(d[i + 1] - 30) < 8 && Math.abs(d[i + 2] - 26) < 8) n++;
  }
  return +(n / (d.length / 4)).toFixed(4);
})()`;

/** Resolves on the first animation frame after the paint canvas changes size. */
const WAIT_FOR_RESIZE = String.raw`(oldWidth) => new Promise((resolve) => {
  const c = document.querySelector("[aria-labelledby=hero-title] canvas");
  const check = () => (c.width !== oldWidth ? resolve(c.width) : requestAnimationFrame(check));
  requestAnimationFrame(check);
})`;

async function setViewport(cdp, vp, orientation) {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: vp.width,
    height: vp.height,
    deviceScaleFactor: vp.dpr,
    mobile: vp.mobile,
    ...(orientation && { screenOrientation: orientation }),
  });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: vp.mobile });
}

async function load(cdp) {
  await cdp.send("Page.navigate", { url: args.url });
  await sleep(1500);
  await cdp.evaluate(PAGE_HELPERS);
}

async function clickButton(cdp, text) {
  await cdp.evaluate(
    `[...document.querySelectorAll("[aria-labelledby=hero-title] button")].find((b) => b.textContent.trim() === ${JSON.stringify(text)}).click()`,
  );
}

async function screenshot(cdp, file) {
  const shot = await cdp.send("Page.captureScreenshot", { format: "png" });
  if (file) writeFileSync(join(OUT_DIR, file), Buffer.from(shot.data, "base64"));
  return shot.data;
}

/** Keeps the lower of each statistic across two samples. */
function worse(a, b) {
  if (a === null || b === null || typeof a !== "object") return a ?? b;
  if ("p1" in a) return { min: Math.min(a.min, b.min), p1: Math.min(a.p1, b.p1), median: Math.min(a.median, b.median) };
  return Object.fromEntries(Object.keys(a).map((k) => [k, worse(a[k], b[k])]));
}

async function measureModes(cdp, vp) {
  await setViewport(cdp, vp);
  await load(cdp);
  await sleep(3500);
  const result = { layout: await cdp.evaluate(LAYOUT) };
  for (const mode of MODES) {
    note(`${mode.label}: text contrast`);
    await clickButton(cdp, mode.label);
    await sleep(mode.slug === "night" ? 1000 : 6000);
    let merged = null;
    for (let sample = 0; sample < 2; sample++) {
      if (sample > 0) await sleep(1500);
      if (sample === 0) await screenshot(cdp, `${args.label}-${vp.name}-${mode.slug}.png`);
      await cdp.evaluate(HIDE_TEXT);
      await sleep(50);
      const bg = await screenshot(cdp);
      await cdp.evaluate(SHOW_TEXT);
      const measured = await cdp.evaluate(`(${ANALYZE})(${JSON.stringify(bg)}, ${vp.dpr})`);
      if (mode.slug === "night") {
        measured.night = await cdp.evaluate(`(${NIGHT_EDGES})(${JSON.stringify(bg)}, ${vp.dpr})`);
      }
      merged = merged ? worse(merged, measured) : measured;
    }
    note(`${mode.label}: focus rings`);
    merged.ring = await measureRings(cdp, vp);
    result[mode.slug] = merged;
  }
  return result;
}

/** Presses Enter or Escape. Enter carries `text`, which is what activates a focused link or button. */
async function pressKey(cdp, key) {
  const keys = { Enter: { code: "Enter", windowsVirtualKeyCode: 13, text: "\r" }, Escape: { code: "Escape", windowsVirtualKeyCode: 27 } };
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key, ...keys[key] });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key, ...keys[key], text: undefined });
}

async function pressTab(cdp) {
  const key = { key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 };
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", ...key });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", ...key });
}

/**
 * Pauses the painting so nothing moves, then Tabs through the hero's
 * controls (real keyboard focus, so :focus-visible applies) and measures
 * each one's ring. Resumes motion afterward.
 */
async function measureRings(cdp, vp) {
  await clickButton(cdp, "Pause motion");
  await sleep(1500);
  // Focus the body so Tab starts from the top of the page.
  await cdp.evaluate(`(() => { document.body.tabIndex = -1; document.body.focus(); document.body.removeAttribute("tabindex"); })()`);
  const rings = {};
  // The skip link and the header come first in the Tab order, so Tab past
  // them until focus reaches the hero, then measure until it leaves.
  let reached = false;
  for (let i = 0; i < 20; i++) {
    await pressTab(cdp);
    const name = await cdp.evaluate(
      `(() => { const el = document.activeElement; return el?.closest("[aria-labelledby=hero-title]") && el.matches("button, a") ? el.textContent.trim() : null; })()`,
    );
    if (!name) {
      if (reached) break;
      continue;
    }
    reached = true;
    // Focusing can scroll the page, so the unfocused reference is taken
    // here, at the same scroll position, with only the ring hidden.
    const focused = await screenshot(cdp);
    await cdp.evaluate(HIDE_RING);
    const plain = await screenshot(cdp);
    await cdp.evaluate(SHOW_RING);
    rings[name] = await cdp.evaluate(`(${RING})(${JSON.stringify(plain)}, ${JSON.stringify(focused)}, ${vp.dpr})`);
  }
  await cdp.evaluate(`document.activeElement?.blur(); window.scrollTo(0, 0)`);
  await clickButton(cdp, "Pause motion");
  return rings;
}

function strokeStats(frames) {
  const counts = frames.map((f) => f.strokes).filter((n) => n > 0);
  if (!counts.length) return { frames: 0 };
  const sorted = [...counts].sort((a, b) => a - b);
  return { frames: counts.length, median: sorted[Math.floor(sorted.length / 2)], max: sorted[sorted.length - 1] };
}

/**
 * Rotates the phone portrait → landscape → portrait and checks that the
 * painting is kept (little bare underpaint right after) and that the opening
 * reveal doesn't replay (no jump in strokes per frame).
 */
async function rotationTest(cdp, variant) {
  const portrait = VIEWPORTS.find((v) => v.name === "phone");
  const landscape = VIEWPORTS.find((v) => v.name === "phone-landscape");
  await cdp.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: variant === "reduced" ? "reduce" : "no-preference" }],
  });
  await setViewport(cdp, portrait, { type: "portraitPrimary", angle: 0 });
  await load(cdp);
  await sleep(5000);
  if (variant === "paused") {
    await clickButton(cdp, "Pause motion");
    await sleep(1500);
  }

  const steps = [];
  for (const [vp, orientation] of [
    [landscape, { type: "landscapePrimary", angle: 90 }],
    [portrait, { type: "portraitPrimary", angle: 0 }],
  ]) {
    const before = await cdp.evaluate(`window.__frames.splice(0)`);
    const oldWidth = await cdp.evaluate(`document.querySelector("[aria-labelledby=hero-title] canvas").width`);
    await setViewport(cdp, vp, orientation);
    await cdp.evaluate(`(${WAIT_FOR_RESIZE})(${oldWidth})`);
    const underpaintRightAfter = await cdp.evaluate(UNDERPAINT_SHARE);
    await sleep(150);
    await screenshot(cdp, `${args.label}-rotate-${variant}-${vp.name}-0.2s.png`);
    await sleep(800);
    await screenshot(cdp, `${args.label}-rotate-${variant}-${vp.name}-1s.png`);
    await sleep(2000);
    await screenshot(cdp, `${args.label}-rotate-${variant}-${vp.name}-3s.png`);
    const after = (await cdp.evaluate(`window.__frames.splice(0)`)).filter((f) => f.strokes > 0);
    const early = strokeStats(after.slice(0, 20));
    const settled = strokeStats(after.slice(-20));
    steps.push({
      to: vp.name,
      underpaintRightAfter,
      strokesPerFrameBefore: strokeStats(before.slice(-30)),
      strokesPerFrameAfter: strokeStats(after),
      // The opening reveal paints up to 1.8× the usual strokes in its first
      // frames, so a replayed reveal shows as early frames well above the
      // settled ones. About 1.0 means no replay.
      earlyVsSettled: settled.median ? +(early.max / settled.median).toFixed(2) : null,
    });
  }
  await cdp.send("Emulation.setEmulatedMedia", { features: [] });
  return steps;
}

/** Frame rate and strokes per frame on the phone, unthrottled and at 4× CPU slowdown. */
async function perfTest(cdp) {
  const phone = VIEWPORTS.find((v) => v.name === "phone");
  const out = {};
  for (const rate of [1, 4]) {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate });
    await setViewport(cdp, phone);
    await load(cdp);
    await sleep(4000);
    await cdp.evaluate(`window.__frames.splice(0)`);
    await sleep(4000);
    const frames = await cdp.evaluate(`window.__frames.splice(0)`);
    const seconds = (frames.at(-1).ts - frames[0].ts) / 1000;
    out[`cpu${rate}x`] = { fps: +((frames.length - 1) / seconds).toFixed(1), ...strokeStats(frames) };
  }
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  return out;
}

async function setReducedMotion(cdp, on) {
  await cdp.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: on ? "reduce" : "no-preference" }],
  });
}

/**
 * The README's screenshot (#32). Reduced motion makes the hero paint its
 * still off screen and swap it in finished, so the picture is never caught
 * half-painted. The strokes are random, so each retake is a slightly
 * different painting of the same scene.
 * It goes in docs/images/, not public/, so the site doesn't deploy it. WebP
 * at quality 80 keeps the brushstroke texture at a fraction of a PNG's size.
 */
const README_SHOT = "docs/images/hero-night.webp";

async function readmeShot(cdp) {
  await setReducedMotion(cdp, true);
  await setViewport(cdp, VIEWPORTS.find((v) => v.name === "desktop"));
  // Headless Chrome draws a classic scrollbar down the right edge; a visitor's
  // browser usually overlays or hides it, so leave it out of the picture.
  await cdp.send("Emulation.setScrollbarsHidden", { hidden: true });
  await cdp.send("Page.navigate", { url: args.url });
  await sleep(300);
  const swapAt = await cdp.evaluate(`(${WAIT_FOR_SWAP})(0, 20000)`);
  if (swapAt === null) throw new Error("The still frame never appeared.");
  // Fraunces and Inter must be in before the shot, or the heading may be in
  // the fallback font.
  await cdp.evaluate(`document.fonts.ready.then(() => true)`);
  await sleep(500);
  const shot = await cdp.send("Page.captureScreenshot", { format: "webp", quality: 80 });
  const bytes = Buffer.from(shot.data, "base64");
  mkdirSync("docs/images", { recursive: true });
  writeFileSync(README_SHOT, bytes);
  return bytes.length;
}

/** Animation frames that ran in the next `ms` milliseconds (0 means the loop is stopped). */
async function framesDuring(cdp, ms) {
  await cdp.evaluate(`window.__frames.splice(0)`);
  await sleep(ms);
  return (await cdp.evaluate(`window.__frames.splice(0)`)).length;
}

const now = (cdp) => cdp.evaluate(`performance.now()`);
const visibleStrokes = (cdp) => cdp.evaluate(`window.__counts.visible`);
const pausePressed = (cdp) =>
  cdp.evaluate(`[...document.querySelectorAll("[aria-labelledby=hero-title] button")].find((b) => b.textContent.trim() === "Pause motion").getAttribute("aria-pressed")`);

/**
 * Runs `action` while sampling the canvases, and reports what a paused
 * visitor would see: visible strokes (should be 0), the distinct canvas
 * states sampled (2 = one clean swap), and how long until the still landed.
 *
 * `fromLive`: the action pauses a running painting. A frame already in
 * flight may still paint, so strokes are only counted in frames that start
 * over 100 ms after the action, and sampling starts then too (so a still
 * that lands within those 100 ms shows as 1 state, not 2).
 */
async function pausedChange(cdp, action, { fromLive = false, timeout = 15000 } = {}) {
  await cdp.evaluate(`window.__frames.splice(0)`);
  const before = await visibleStrokes(cdp);
  if (!fromLive) await cdp.evaluate(START_SAMPLER);
  const start = await now(cdp);
  await action();
  if (fromLive) {
    await sleep(100);
    await cdp.evaluate(START_SAMPLER);
  }
  const swapAt = await cdp.evaluate(`(${WAIT_FOR_SWAP})(${start}, ${timeout})`);
  await sleep(300);
  const states = await cdp.evaluate(STOP_SAMPLER);
  const frames = await cdp.evaluate(`window.__frames.splice(0)`);
  const events = await cdp.evaluate(`window.__events.filter((e) => e.t > ${start}).map((e) => e.kind)`);
  return {
    msToStill: swapAt === null ? null : Math.round(swapAt - start),
    visibleStrokes: fromLive
      ? frames.filter((f) => f.ts > start + 100).reduce((sum, f) => sum + f.strokes, 0)
      : (await visibleStrokes(cdp)) - before,
    states,
    events,
    framesAfter: await framesDuring(cdp, 1000),
  };
}

/**
 * The still-frame checks for #6. With reduced motion (or Pause motion), the
 * painting must never fill in or move: no strokes on the visible canvas, the
 * finished still swapped in at once, and no frames running afterward.
 */
async function stillTest(cdp) {
  const out = {};
  const desktop = VIEWPORTS.find((v) => v.name === "desktop");
  const phone = VIEWPORTS.find((v) => v.name === "phone");
  const landscape = VIEWPORTS.find((v) => v.name === "phone-landscape");

  // First load with reduced motion, at full speed and on a slow phone.
  for (const [vp, rate] of [[desktop, 1], [phone, 1], [phone, 4]]) {
    const key = `firstLoad-${vp.name}-cpu${rate}x`;
    process.stdout.write(`  ${key}\n`);
    await setReducedMotion(cdp, true);
    await setViewport(cdp, vp);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate });
    await cdp.send("Page.navigate", { url: args.url });
    await sleep(300);
    const swapAt = await cdp.evaluate(`(${WAIT_FOR_SWAP})(0, 20000)`);
    const fcp = await cdp.evaluate(`performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? null`);
    const longTasks = await cdp.evaluate(`window.__longTasks.filter((e) => e.t < ${swapAt ?? 0} + 100).map((e) => Math.round(e.ms))`);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    await sleep(300);
    // Screenshots first: reading the canvases back (SNAP) can itself change
    // how Chrome composites the light layer, by a step (see SNAP).
    const shotBefore = await screenshot(cdp);
    const framesAfter = await framesDuring(cdp, 1500);
    const shotAfter = await screenshot(cdp);
    // If the screen changed, record where (CSS pixels) and keep both shots.
    const screenChange =
      shotBefore !== shotAfter
        ? await cdp.evaluate(`(${SHOT_DIFF})(${JSON.stringify(shotBefore)}, ${JSON.stringify(shotAfter)}, ${vp.dpr})`)
        : null;
    // On emulated phones the overlay scrollbar fades out a moment after the
    // page loads: a change only in the rightmost few pixels, full height.
    // That's the browser, not the page, so it doesn't count.
    const scrollbarOnly = vp.mobile && screenChange?.box && screenChange.box[0] >= vp.width - 6;
    const screenChangedWhileSettled = !!screenChange && !scrollbarOnly;
    if (screenChange) {
      writeFileSync(join(OUT_DIR, `${args.label}-${key}-settled-a.png`), Buffer.from(shotBefore, "base64"));
      writeFileSync(join(OUT_DIR, `${args.label}-${key}-settled-b.png`), Buffer.from(shotAfter, "base64"));
    }
    await cdp.evaluate(SNAP);
    const snapBefore = await cdp.evaluate(SNAP);
    await sleep(500);
    out[key] = {
      msToStill: swapAt === null ? null : Math.round(swapAt),
      fcp: fcp === null ? null : Math.round(fcp),
      visibleStrokes: await visibleStrokes(cdp),
      offscreenStrokes: await cdp.evaluate(`window.__counts.offscreen`),
      swaps: (await cdp.evaluate(`window.__events`)).filter((e) => e.kind === "swap").length,
      longestTaskMs: longTasks.length ? Math.max(...longTasks) : 0,
      longTasks: longTasks.length,
      framesAfter,
      screenChangedWhileSettled,
      ...(screenChange && { screenChange }),
      canvasChangedWhileSettled: snapBefore !== (await cdp.evaluate(SNAP)),
      underpaintShare: await cdp.evaluate(UNDERPAINT_SHARE),
      pausePressed: await pausePressed(cdp),
    };
    await screenshot(cdp, `${args.label}-still-${vp.name}-cpu${rate}x-night.png`);
  }

  // Still on the phone with reduced motion: mode changes, lanterns, rotation.
  await setViewport(cdp, phone, { type: "portraitPrimary", angle: 0 });
  await load(cdp);
  await cdp.evaluate(`(${WAIT_FOR_SWAP})(0, 15000)`);
  await sleep(300);
  for (const mode of [...MODES.slice(1), MODES[0]]) {
    process.stdout.write(`  mode ${mode.slug} (reduced)\n`);
    out[`mode-${mode.slug}`] = await pausedChange(cdp, () => clickButton(cdp, mode.label));
    await screenshot(cdp, `${args.label}-still-phone-${mode.slug}.png`);
  }

  process.stdout.write("  lanterns (reduced)\n");
  for (const [name, action] of [
    ["button", () => clickButton(cdp, "Float a lantern")],
    ["water", async () => {
      const at = { x: Math.round(phone.width * 0.75), y: Math.round(phone.height * 0.6), button: "left", clickCount: 1 };
      await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", ...at });
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...at });
    }],
  ]) {
    await cdp.evaluate(SAVE_PAINT);
    const before = await visibleStrokes(cdp);
    await cdp.evaluate(`window.__frames.splice(0)`);
    await action();
    await sleep(300);
    const frames = await cdp.evaluate(`window.__frames.splice(0)`);
    out[`lantern-${name}`] = {
      visibleStrokes: (await visibleStrokes(cdp)) - before,
      framesWithStrokes: frames.filter((f) => f.strokes > 0).length,
      changedBox: await cdp.evaluate(DIFF_BOX),
      framesAfter: await framesDuring(cdp, 1000),
      pausePressed: await pausePressed(cdp),
    };
  }
  await screenshot(cdp, `${args.label}-still-phone-lanterns.png`);

  for (const [vp, orientation] of [
    [landscape, { type: "landscapePrimary", angle: 90 }],
    [phone, { type: "portraitPrimary", angle: 0 }],
  ]) {
    process.stdout.write(`  rotate to ${vp.name} (reduced)\n`);
    out[`rotate-${vp.name}`] = await pausedChange(cdp, () => setViewport(cdp, vp, orientation));
    await screenshot(cdp, `${args.label}-still-rotate-${vp.name}.png`);
  }

  // Motion on, then Pause motion pressed on a finished painting: it should
  // stop at once, with no catch-up strokes.
  process.stdout.write("  pause a finished painting\n");
  await setReducedMotion(cdp, false);
  await setViewport(cdp, desktop);
  await load(cdp);
  await sleep(6000);
  await cdp.evaluate(`window.__frames.splice(0)`);
  const pressedAt = await now(cdp);
  await clickButton(cdp, "Pause motion");
  await sleep(100);
  const inFlight = (await cdp.evaluate(`window.__frames.splice(0)`)).filter((f) => f.ts > pressedAt && f.strokes > 0);
  // Screenshots before any canvas readback (see SNAP).
  const pauseShot = await screenshot(cdp);
  const pauseFrames = await framesDuring(cdp, 1500);
  const screenChanged = pauseShot !== (await screenshot(cdp));
  await cdp.evaluate(START_SAMPLER);
  await sleep(1000);
  out.pauseFinished = {
    // At most the one frame already under way when the click landed.
    framesWithStrokesAfterPress: inFlight.length,
    swaps: (await cdp.evaluate(`window.__events.filter((e) => e.t > ${pressedAt})`)).length,
    framesAfter: pauseFrames,
    screenChanged,
    states: await cdp.evaluate(STOP_SAMPLER),
  };
  await screenshot(cdp, `${args.label}-still-paused-live-desktop.png`);
  process.stdout.write("  mode change while paused (Pause motion)\n");
  out.pausedMode = await pausedChange(cdp, () => clickButton(cdp, "Day"));
  await screenshot(cdp, `${args.label}-still-desktop-day.png`);
  await clickButton(cdp, "Night");

  // Pause during the opening reveal, then resume: a still lands, and
  // resuming doesn't replay the reveal over it.
  process.stdout.write("  pause during the reveal, then resume\n");
  await load(cdp);
  out.pauseDuringReveal = await pausedChange(cdp, () => clickButton(cdp, "Pause motion"), { fromLive: true });
  await cdp.evaluate(`window.__frames.splice(0)`);
  await clickButton(cdp, "Pause motion");
  await sleep(2500);
  const resumed = (await cdp.evaluate(`window.__frames.splice(0)`)).filter((f) => f.strokes > 0);
  const early = strokeStats(resumed.slice(0, 20));
  const settled = strokeStats(resumed.slice(-20));
  out.pauseDuringReveal.resumeEarlyVsSettled = settled.median ? +(early.max / settled.median).toFixed(2) : null;

  // The OS setting turned on mid-reveal, without a reload.
  process.stdout.write("  reduced motion turned on mid-reveal\n");
  await load(cdp);
  out.osSettingMidReveal = await pausedChange(cdp, () => setReducedMotion(cdp, true), { fromLive: true });
  out.osSettingMidReveal.pausePressed = await pausePressed(cdp);

  // Before hydration (scripts off): the Pause button's look must already
  // match the engine, which starts paused with reduced motion.
  process.stdout.write("  Pause button before hydration\n");
  await cdp.send("Emulation.setScriptExecutionDisabled", { value: true });
  out.beforeHydration = {};
  for (const on of [true, false]) {
    await setReducedMotion(cdp, on);
    await cdp.send("Page.navigate", { url: args.url });
    await sleep(1500);
    out.beforeHydration[on ? "reduced" : "noPreference"] = await cdp.evaluate(
      `(() => { const b = [...document.querySelectorAll("[aria-labelledby=hero-title] button")].find((x) => x.textContent.trim() === "Pause motion"); const s = getComputedStyle(b); return { background: s.backgroundColor, color: s.color, ariaPressed: b.getAttribute("aria-pressed") }; })()`,
    );
    await screenshot(cdp, `${args.label}-still-no-js-${on ? "reduced" : "no-preference"}.png`);
  }
  await cdp.send("Emulation.setScriptExecutionDisabled", { value: false });
  await cdp.send("Emulation.setEmulatedMedia", { features: [] });
  return out;
}

/*
 * Shared-layout checks (#7): header, nav, skip link, landmarks, footer,
 * string dividers, and the hero's fade into the page.
 */

/** What's focused now: its name, tag, landmark, and whether a focus ring shows. */
const FOCUSED = String.raw`(() => {
  const el = document.activeElement;
  if (!el || el === document.body) return null;
  const s = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return {
    name: (el.getAttribute("aria-label") || el.textContent || el.id).trim().replace(/\s+/g, " ").slice(0, 40),
    tag: el.tagName.toLowerCase(),
    landmark: el.closest("header, nav, main, footer")?.tagName.toLowerCase() ?? "none",
    ring: s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0,
    onScreen: r.width > 1 && r.bottom > 0 && r.top < innerHeight,
  };
})()`;

/** The nav's state: inline links or the Menu fallback, and whether the inline links share one line. */
const NAV_STATE = String.raw`(() => {
  const nav = document.querySelector("nav[aria-label=Main]");
  const button = nav.querySelector("button[aria-controls]");
  const inline = [...nav.querySelectorAll("ul:not(#site-menu) a")];
  const visible = inline.filter((a) => a.checkVisibility({ visibilityProperty: true }));
  const tops = new Set(visible.map((a) => Math.round(a.getBoundingClientRect().top)));
  const panel = document.getElementById("site-menu");
  return {
    menuButton: !!button,
    expanded: button?.getAttribute("aria-expanded") ?? null,
    panelVisible: !!panel && panel.checkVisibility(),
    inlineVisible: visible.length,
    inlineTotal: inline.length,
    oneLine: tops.size <= 1,
    headerHeight: Math.round(document.querySelector("header").getBoundingClientRect().height),
    brandCurrent: document.querySelector("header a[href='/']")?.getAttribute("aria-current") ?? null,
  };
})()`;

/** Landmark counts. */
const LANDMARKS = String.raw`(() => ({
  header: document.querySelectorAll("body > header").length,
  nav: document.querySelectorAll("nav[aria-label]").length,
  main: document.querySelectorAll("main").length,
  footer: document.querySelectorAll("body > footer").length,
  contactTarget: !!document.getElementById("contact"),
  collectionTarget: !!document.getElementById("collection"),
  aboutTarget: !!document.getElementById("about"),
}))()`;

/**
 * The Collection (#8): where it sits, its heading, and each card's name,
 * kind, status, Medium label, and artwork label. Links and focusable
 * elements are counted so a link to a page that doesn't exist yet shows
 * up, and animations so anything that moves does.
 */
const COLLECTION = String.raw`(() => {
  const section = document.getElementById("collection");
  if (!section) return null;
  const hero = "[aria-labelledby=hero-title]";
  const cards = [...section.querySelectorAll("article")].map((a) => {
    const ps = [...a.querySelectorAll("p")].map((p) => p.textContent.trim());
    return {
      title: a.querySelector("h3")?.textContent.trim() ?? null,
      named: document.getElementById(a.getAttribute("aria-labelledby"))?.textContent.trim() ?? null,
      kind: a.dataset.kind ?? null,
      status: ps.find((t) => t.startsWith("Status:"))?.slice(7).trim() ?? null,
      medium: ps.find((t) => t.startsWith("Medium"))?.split(":")[0] ?? null,
      artworkLabeled: [...a.querySelectorAll("svg")].every((svg) => svg.getAttribute("role") === "img" && !!svg.getAttribute("aria-label")),
    };
  });
  const r = section.getBoundingClientRect();
  return {
    heading: document.getElementById(section.getAttribute("aria-labelledby"))?.textContent.trim() ?? null,
    afterHero: !!section.previousElementSibling?.matches(hero),
    beforeAbout: section.nextElementSibling?.id === "about",
    dividerAtTop: !!section.firstElementChild?.matches("div[aria-hidden=true]"),
    cards,
    links: [...section.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")),
    focusable: section.querySelectorAll("a[href], button, input, select, textarea, [tabindex]:not([tabindex='-1'])").length,
    animations: section.getAnimations({ subtree: true }).length,
    height: Math.round(r.height),
    horizontalScroll: document.documentElement.scrollWidth > innerWidth,
  };
})()`;

/** Whether the Collection report meets #8: placement, names, labels, studies for planned work, nothing moving. */
function collectionOk(c) {
  if (!c) return false;
  return (
    c.heading === "The Collection" && c.afterHero && c.beforeAbout && c.dividerAtTop &&
    c.cards.length > 0 &&
    c.cards.every((card) => card.title && card.named === card.title && card.status && card.medium && card.artworkLabeled) &&
    c.cards.every((card) => !card.status.startsWith("Planned") || (card.kind === "study" && card.medium === "Medium (draft)")) &&
    c.animations === 0 && !c.horizontalScroll
  );
}

/**
 * About (#9): where it sits (after the Collection, last in main, so the
 * footer follows), its heading and opening line, its group headings, and
 * the oil-painting placard. Like the Collection it has no links of its own
 * and nothing that moves, so focusable and animations should both be 0.
 */
const ABOUT = String.raw`(() => {
  const section = document.getElementById("about");
  if (!section) return null;
  const r = section.getBoundingClientRect();
  return {
    heading: document.getElementById(section.getAttribute("aria-labelledby"))?.textContent.trim() ?? null,
    lead: section.querySelector("h2 + p")?.textContent.trim() ?? null,
    afterCollection: section.previousElementSibling?.id === "collection",
    beforeFooter: !section.nextElementSibling && section.closest("main")?.nextElementSibling?.tagName === "FOOTER",
    dividerAtTop: !!section.firstElementChild?.matches("div[aria-hidden=true]"),
    groups: [...section.querySelectorAll("h3")].map((h) => h.textContent.trim()),
    skillGroups: [...section.querySelectorAll("h3 + dl > div > dt")].map((dt) => dt.textContent.trim()),
    placard: section.querySelector("h4")?.textContent.trim() ?? null,
    links: [...section.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")),
    focusable: section.querySelectorAll("a[href], button, input, select, textarea, [tabindex]:not([tabindex='-1'])").length,
    animations: section.getAnimations({ subtree: true }).length,
    height: Math.round(r.height),
    horizontalScroll: document.documentElement.scrollWidth > innerWidth,
  };
})()`;

/** Whether the About report meets #9: placement, heading, both groups, nothing to Tab to, nothing moving. */
function aboutOk(a) {
  if (!a) return false;
  return (
    a.heading === "About" && !!a.lead && a.afterCollection && a.beforeFooter && a.dividerAtTop &&
    a.groups.includes("Skills") && a.groups.includes("Off the clock") && a.skillGroups.length > 0 && !!a.placard &&
    a.focusable === 0 && a.animations === 0 && !a.horizontalScroll
  );
}

/** Mean color of the last pixel row of the hero and the first row below it, from a screenshot. */
const SEAM = String.raw`async (shot, dpr) => {
  const img = new Image();
  img.src = "data:image/png;base64," + shot;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = img.width; c.height = img.height;
  const x = c.getContext("2d");
  x.drawImage(img, 0, 0);
  const bottom = Math.round(document.querySelector("[aria-labelledby=hero-title]").getBoundingClientRect().bottom * dpr);
  const row = (y) => {
    const d = x.getImageData(0, Math.max(0, Math.min(c.height - 1, y)), c.width, 1).data;
    const m = [0, 0, 0];
    for (let i = 0; i < d.length; i += 4) { m[0] += d[i]; m[1] += d[i + 1]; m[2] += d[i + 2]; }
    return m.map((v) => Math.round(v / (d.length / 4)));
  };
  const above = row(bottom - 2), below = row(bottom + 1);
  return { heroLastRow: above, pageBelow: below, maxChannelDiff: Math.max(...above.map((v, i) => Math.abs(v - below[i]))) };
}`;

/** Hovers the footer's string divider and returns how many animations started. */
async function pluckDivider(cdp) {
  const at = await cdp.evaluate(`(() => {
    const d = document.querySelector("footer > div[aria-hidden]");
    d.scrollIntoView({ block: "center" });
    const r = d.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  })()`);
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: at.x, y: at.y - 80 });
  await sleep(50);
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: at.x, y: at.y });
  await sleep(100);
  const running = await cdp.evaluate(`document.querySelector("footer > div[aria-hidden] path").getAnimations().length`);
  await sleep(1200);
  const after = await cdp.evaluate(`document.querySelector("footer > div[aria-hidden] path").getAnimations().length`);
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: at.x, y: at.y - 80 });
  return { running, after };
}

/** Where the page is scrolled to, and whether the footer is on screen. */
const SCROLL_STATE = String.raw`(() => {
  const f = document.querySelector("footer").getBoundingClientRect();
  const c = document.getElementById("collection")?.getBoundingClientRect();
  const a = document.getElementById("about")?.getBoundingClientRect();
  // About is the last section, so on a tall screen there may not be enough
  // page below it to scroll its top all the way up. Then the browser scrolls
  // as far as it can, and the link has done its job if the page is at the
  // bottom and About's top is on screen.
  const atBottom = scrollY + innerHeight >= document.documentElement.scrollHeight - 1;
  return {
    scrollY: Math.round(scrollY),
    atTop: scrollY < 1,
    footerOnScreen: f.top < innerHeight && f.bottom > 0,
    collectionAtTop: !!c && Math.abs(c.top) < 2,
    aboutReached: !!a && (Math.abs(a.top) < 2 || (atBottom && a.top >= 0)),
    hash: location.hash,
  };
})()`;

/** A real mouse click (or tap) on the first element matching `selector`. */
async function clickAt(cdp, selector) {
  const at = await cdp.evaluate(`(() => {
    const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  })()`);
  const click = { ...at, button: "left", clickCount: 1 };
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", ...click });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...click });
  await sleep(500);
  return cdp.evaluate(SCROLL_STATE);
}

/**
 * The header's links, clicked more than once, the way a visitor would:
 * Contact must reach the footer every time (even when the URL already ends
 * in #contact), Work must bring the Collection to the top of the screen
 * every time, About must reach About every time, and my name must go to
 * the top of the home page every time.
 */
async function headerLinks(cdp) {
  const contact = `header nav a[href="/#contact"]`;
  const work = `header nav a[href="/#collection"]`;
  const about = `header nav a[href="/#about"]`;
  const brand = `header a[href="/"]`;
  // The header isn't sticky, so scroll back up before each click, as a
  // visitor would. For my name only 20px, so the header is still on screen
  // and "back to the top" is a real move.
  const scrollTo = (y) => cdp.evaluate(`window.scrollTo(0, ${y})`);
  const out = {};
  await scrollTo(0);
  out.contactFirst = await clickAt(cdp, contact);
  await scrollTo(0);
  out.contactAgain = await clickAt(cdp, contact);
  await scrollTo(20);
  out.brandAfterContact = await clickAt(cdp, brand);
  await scrollTo(20);
  out.brandAgain = await clickAt(cdp, brand);
  out.contactAfterBrand = await clickAt(cdp, contact);
  await scrollTo(0);
  out.workFirst = await clickAt(cdp, work);
  await scrollTo(0);
  out.workAgain = await clickAt(cdp, work);
  await scrollTo(20);
  out.brandAfterWork = await clickAt(cdp, brand);
  await scrollTo(0);
  out.aboutFirst = await clickAt(cdp, about);
  await scrollTo(0);
  out.aboutAgain = await clickAt(cdp, about);
  await scrollTo(20);
  out.brandAfterAbout = await clickAt(cdp, brand);
  out.ok =
    out.workFirst.collectionAtTop && out.workAgain.collectionAtTop && out.brandAfterWork.atTop &&
    out.aboutFirst.aboutReached && out.aboutAgain.aboutReached && out.brandAfterAbout.atTop &&
    out.contactFirst.footerOnScreen && out.contactAgain.footerOnScreen && out.contactAfterBrand.footerOnScreen &&
    out.brandAfterContact.atTop && out.brandAgain.atTop;
  return out;
}

async function pageTest(cdp) {
  const out = {};
  for (const vp of VIEWPORTS.filter((v) => ["desktop", "phone", "narrow"].includes(v.name))) {
    process.stdout.write(`  ${vp.name}\n`);
    const r = (out[vp.name] = {});
    await step(`page ${vp.name}`, async () => {
      await setReducedMotion(cdp, false);
      await setViewport(cdp, vp);
      await load(cdp);
      await sleep(2000);
      r.landmarks = await cdp.evaluate(LANDMARKS);
      r.nav = await cdp.evaluate(NAV_STATE);
      r.layout = await cdp.evaluate(LAYOUT);
      r.collection = await cdp.evaluate(COLLECTION);

      // The Collection, screen by screen from its top.
      note("Collection screenshots");
      if (vp.name !== "narrow" && r.collection) {
        const top = await cdp.evaluate(`Math.round(document.getElementById("collection").getBoundingClientRect().top + scrollY)`);
        const screens = Math.ceil(r.collection.height / vp.height);
        for (let i = 0; i < screens; i++) {
          await cdp.evaluate(`window.scrollTo(0, ${top + i * vp.height})`);
          await sleep(200);
          await screenshot(cdp, `${args.label}-collection-${vp.name}-${i + 1}.png`);
        }
        await cdp.evaluate(`window.scrollTo(0, 0)`);
      }

      // About, screen by screen from its top, the same way.
      r.about = await cdp.evaluate(ABOUT);
      note("About screenshots");
      if (vp.name !== "narrow" && r.about) {
        const top = await cdp.evaluate(`Math.round(document.getElementById("about").getBoundingClientRect().top + scrollY)`);
        const screens = Math.ceil(r.about.height / vp.height);
        for (let i = 0; i < screens; i++) {
          await cdp.evaluate(`window.scrollTo(0, ${top + i * vp.height})`);
          await sleep(200);
          await screenshot(cdp, `${args.label}-about-${vp.name}-${i + 1}.png`);
        }
        await cdp.evaluate(`window.scrollTo(0, 0)`);
      }

      // Screenshots: the first screen and the bottom of the page, in each mode.
      if (vp.name !== "narrow") {
        for (const mode of MODES) {
          note(`${mode.label}: top and bottom screenshots`);
          await clickButton(cdp, mode.label);
          await sleep(mode.slug === "night" ? 500 : 5000);
          await cdp.evaluate(`window.scrollTo(0, 0)`);
          await sleep(200);
          await screenshot(cdp, `${args.label}-page-${vp.name}-${mode.slug}-top.png`);
          await cdp.evaluate(`window.scrollTo(0, document.documentElement.scrollHeight)`);
          await sleep(300);
          const shot = await screenshot(cdp, `${args.label}-page-${vp.name}-${mode.slug}-bottom.png`);
          r[`seam-${mode.slug}`] = await cdp.evaluate(`(${SEAM})(${JSON.stringify(shot)}, ${vp.dpr})`);
        }
        await clickButton(cdp, "Night");
        await cdp.evaluate(`window.scrollTo(0, 0)`);
        await sleep(1500);
      }

      // Tab through the whole page from the top, with a screenshot of each stop.
      note("Tab-through");
      await cdp.evaluate(`(() => { document.activeElement?.blur(); window.scrollTo(0, 0); })()`);
      const order = [];
      for (let i = 0; i < 30; i++) {
        await pressTab(cdp);
        await sleep(60);
        const f = await cdp.evaluate(FOCUSED);
        if (!f || (order.length && f.name === order[0].name && f.tag === order[0].tag)) break;
        order.push(f);
        if (vp.name !== "narrow") await screenshot(cdp, `${args.label}-tab-${vp.name}-${String(i + 1).padStart(2, "0")}.png`);
      }
      r.tabOrder = order;

      // Skip link: the first stop, visible when focused, and Enter moves focus into main.
      note("skip link");
      await cdp.evaluate(`(() => { document.activeElement?.blur(); window.scrollTo(0, 0); })()`);
      await pressTab(cdp);
      const skip = await cdp.evaluate(FOCUSED);
      await pressKey(cdp, "Enter");
      await sleep(200);
      await pressTab(cdp);
      const afterSkip = await cdp.evaluate(FOCUSED);
      r.skipLink = { first: skip, nextAfterEnter: afterSkip };

      // Contact and my name, clicked repeatedly (only while the links are inline).
      note("header links");
      if (!r.nav.menuButton) r.links = await headerLinks(cdp);

      // The Menu fallback, when the links don't fit.
      note("Menu");
      if (r.nav.menuButton) {
        const m = (r.menu = {});
        await cdp.evaluate(`document.querySelector("nav[aria-label=Main] button").focus()`);
        await pressKey(cdp, "Enter");
        await sleep(150);
        m.afterEnter = await cdp.evaluate(NAV_STATE);
        await screenshot(cdp, `${args.label}-menu-${vp.name}-open.png`);
        await pressTab(cdp);
        m.tabIntoPanel = await cdp.evaluate(`document.activeElement.closest("#site-menu") ? document.activeElement.textContent.trim() : null`);
        await pressKey(cdp, "Escape");
        await sleep(150);
        m.afterEscape = await cdp.evaluate(NAV_STATE);
        m.focusAfterEscape = await cdp.evaluate(FOCUSED);
        await cdp.evaluate(`document.querySelector("nav[aria-label=Main] button").click()`);
        await sleep(150);
        const opened = await cdp.evaluate(NAV_STATE);
        const outside = { x: Math.round(vp.width / 2), y: Math.round(vp.height * 0.7), button: "left", clickCount: 1 };
        await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", ...outside });
        await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...outside });
        await sleep(150);
        m.outsideClick = { before: opened.expanded, after: (await cdp.evaluate(NAV_STATE)).expanded };
      }

      note("string divider");
      // String divider: plucks with motion on; not with Pause motion or reduced
      // motion. Hidden from the accessibility tree.
      if (vp.name === "desktop") {
        r.divider = { motionOn: await pluckDivider(cdp) };
        await cdp.evaluate(`window.scrollTo(0, 0)`);
        await clickButton(cdp, "Pause motion");
        await sleep(300);
        r.divider.pauseMotion = await pluckDivider(cdp);
        await setReducedMotion(cdp, true);
        await load(cdp);
        r.divider.reducedMotion = await pluckDivider(cdp);
        const { root } = await cdp.send("DOM.getDocument", { depth: 0 });
        const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: "footer > div[aria-hidden] svg" });
        const ax = await cdp.send("Accessibility.getPartialAXTree", { nodeId, fetchRelatives: false });
        r.divider.inAccessibilityTree = !ax.nodes[0].ignored;
        await setReducedMotion(cdp, false);
      }
    });
  }
  return out;
}

function summarize(report) {
  const lines = [];
  const mark = (value, bar) => (value === null || value === undefined ? "  n/a" : `${value.toFixed(2).padStart(5)}${value >= bar ? " " : "*"}`);
  const worstP1 = (group) => {
    const values = Object.values(group ?? {}).filter(Boolean).map((s) => s.p1);
    return values.length ? Math.min(...values) : null;
  };
  let failures = 0;
  lines.push("viewport          mode     heading  intro  pillText  ring   edge    (lightest 1%; * = below bar)");
  for (const [vp, result] of Object.entries(report.modes ?? {})) {
    for (const mode of MODES) {
      const m = result[mode.slug];
      if (!m) continue;
      const cells = [
        [m.heading?.p1, TEXT_MIN],
        [m.intro?.p1, TEXT_MIN],
        [worstP1(m.chipText), TEXT_MIN],
        [worstP1(m.ring), NON_TEXT_MIN],
        [worstP1(m.edge), NON_TEXT_MIN],
      ];
      failures += cells.filter(([v, bar]) => v === null || v === undefined || v < bar).length;
      // Every button and link whose text was measured must also have had its
      // focus ring measured, so a new control (like Resume, #13) can't slip
      // past the ring column by never being reached with Tab.
      const noRing = Object.keys(m.chipText ?? {}).filter((name) => !m.ring?.[name]);
      if (noRing.length) failures++;
      lines.push(
        `${vp.padEnd(17)} ${mode.slug.padEnd(7)} ${cells.map(([v, bar]) => mark(v, bar)).join("  ")}` +
          (noRing.length ? `  * no ring measured: ${noRing.join(", ")}` : ""),
      );
    }
    const l = result.layout;
    const layoutOk = !l.horizontalScroll && l.gapControlsToHeading > 0 && l.targetsUnder44.length === 0 && l.linkRow.ok;
    if (!layoutOk) failures++;
    lines.push(
      `${"".padEnd(17)} layout   ${layoutOk ? "ok" : "*"}  gap ${l.gapControlsToHeading}px, scroll ${l.horizontalScroll}, ` +
        `small targets [${l.targetsUnder44.join(", ")}], heading on first screen ${l.headingFitsFirstScreen}`,
    );
    const row = l.linkRow;
    lines.push(
      `${"".padEnd(17)} links    ${row.ok ? "ok" : "*"}  ${row.links.join(" + ")} on ${row.lines} line(s), ` +
        `min gap ${row.minGap}px (12px wanted), right edge ${row.rightmost}px (padding at ${row.contentRight}px)`,
    );
    const a = l.alignment;
    if (!a.ok) failures++;
    lines.push(
      `${"".padEnd(17)} column   ${a.ok ? "ok" : "*"}  column ${a.columnLeft}–${a.columnRight}px, text ${a.textLeftInset}px in ` +
        `(expected ${a.expectedTextInset}), controls ${a.controlsRightInset}px from the right edge (expected 0)`,
    );
    const n = result.night?.night;
    if (n) {
      lines.push(`${"".padEnd(17)} night edges (median): walls ${n.walls?.median}, roofs ${n.roofs?.median}, gondola hull ${n.hull?.median}`);
    }
  }
  for (const [variant, steps] of Object.entries(report.rotation ?? {})) {
    for (const s of steps) {
      lines.push(
        `rotation ${variant.padEnd(8)} -> ${s.to.padEnd(16)} underpaint right after ${(s.underpaintRightAfter * 100).toFixed(1)}%, ` +
          `early frames ×${s.earlyVsSettled ?? "-"} of settled (strokes/frame max ${s.strokesPerFrameAfter.max ?? "-"}, median ${s.strokesPerFrameAfter.median ?? "-"}), frames ${s.strokesPerFrameAfter.frames}`,
      );
    }
  }
  for (const [rate, p] of Object.entries(report.perf ?? {})) {
    lines.push(`perf phone ${rate}: ${p.fps} fps, strokes/frame median ${p.median}`);
  }
  for (const [name, r] of Object.entries(report.still ?? {})) {
    if (name === "beforeHydration") {
      for (const [media, b] of Object.entries(r)) {
        lines.push(`still ${"before hydration, " + media}: Pause button ${b.background} / ${b.color}, aria-pressed ${b.ariaPressed}`);
      }
      continue;
    }
    const parts = Object.entries(r).map(([k, v]) => `${k} ${typeof v === "object" && v !== null ? JSON.stringify(v) : v}`);
    lines.push(`still ${name}: ${parts.join(", ")}`);
  }
  for (const [vp, r] of Object.entries(report.page ?? {})) {
    const order = r.tabOrder.map((f) => `${f.name}${f.ring ? "" : " (no ring!)"}`).join(" > ");
    lines.push(`page ${vp}: landmarks ${JSON.stringify(r.landmarks)}`);
    lines.push(`page ${vp}: nav ${JSON.stringify(r.nav)}, small targets [${r.layout.targetsUnder44.join(", ")}], heading/link on first screen ${r.layout.headingFitsFirstScreen}/${r.layout.linkFitsFirstScreen}`);
    lines.push(`page ${vp}: Tab order (${r.tabOrder.length}): ${order}`);
    lines.push(`page ${vp}: skip link first "${r.skipLink.first?.name}" (on screen ${r.skipLink.first?.onScreen}), next Tab after Enter "${r.skipLink.nextAfterEnter?.name}"`);
    for (const mode of MODES) {
      const seam = r[`seam-${mode.slug}`];
      if (seam) lines.push(`page ${vp}: hero bottom ${mode.slug} last row ${seam.heroLastRow} vs page ${seam.pageBelow} (max diff ${seam.maxChannelDiff})`);
    }
    if (r.collection !== undefined) {
      const ok = collectionOk(r.collection);
      if (!ok) failures++;
      lines.push(`page ${vp}: collection ${ok ? "ok" : "*"}  ${JSON.stringify(r.collection)}`);
    }
    if (r.about !== undefined) {
      const ok = aboutOk(r.about);
      if (!ok) failures++;
      lines.push(`page ${vp}: about ${ok ? "ok" : "*"}  ${JSON.stringify(r.about)}`);
    }
    if (r.links) {
      if (!r.links.ok) failures++;
      const steps = Object.entries(r.links)
        .filter(([k]) => k !== "ok")
        .map(([k, s]) => `${k} y=${s.scrollY}${s.hash}${s.footerOnScreen ? " footer" : ""}${s.collectionAtTop ? " collection" : ""}${s.aboutReached ? " about" : ""}${s.atTop ? " top" : ""}`);
      lines.push(`page ${vp}: header links ${r.links.ok ? "ok" : "*"}  ${steps.join(", ")}`);
    }
    if (r.menu) lines.push(`page ${vp}: menu ${JSON.stringify(r.menu)}`);
    if (r.divider) lines.push(`page ${vp}: divider ${JSON.stringify(r.divider)}`);
  }
  lines.push(failures ? `${failures} check(s) below the bar.` : "All contrast and layout checks pass.");
  return lines.join("\n");
}

mkdirSync(OUT_DIR, { recursive: true });
const cdp = await connect();
await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: INSTRUMENT });
if (args["readme-shot"]) {
  try {
    const bytes = await step("README screenshot", () => readmeShot(cdp));
    console.log(`Saved ${README_SHOT} (${(bytes / 1024).toFixed(0)} KB)`);
  } finally {
    cdp.close();
  }
  process.exit(0);
}
const only = args.only?.split(",");
const report = { url: args.url, date: new Date().toISOString() };
let failure = null;
try {
  if (!args["no-modes"]) {
    report.modes = {};
    for (const vp of VIEWPORTS) {
      if (only && !only.includes(vp.name)) continue;
      process.stdout.write(`measuring ${vp.name}...\n`);
      report.modes[vp.name] = await step(`contrast ${vp.name}`, () => measureModes(cdp, vp));
    }
  }
  if (args.rotation) {
    report.rotation = {};
    for (const variant of ["running", "paused", "reduced"]) {
      process.stdout.write(`rotation (${variant})...\n`);
      report.rotation[variant] = await step(`rotation ${variant}`, () => rotationTest(cdp, variant));
    }
  }
  if (args.perf) {
    process.stdout.write("performance...\n");
    report.perf = await step("performance", () => perfTest(cdp));
  }
  if (args.still) {
    process.stdout.write("still frames...\n");
    report.still = await step("still frames", () => stillTest(cdp));
  }
  if (args.page) {
    process.stdout.write("page layout...\n");
    report.page = await pageTest(cdp);
  }
} catch (error) {
  failure = error;
} finally {
  cdp.close();
}
report.timing = timing;
if (failure) {
  // Keep what was measured before the failure, for working out what went wrong.
  report.error = failure.message;
  writeFileSync(join(OUT_DIR, `${args.label}-report.json`), JSON.stringify(report, null, 1));
  console.error(`\n${failure.message}`);
  console.error(`What was measured before that is in ${OUT_DIR}/${args.label}-report.json.`);
  process.exit(1);
}
writeFileSync(join(OUT_DIR, `${args.label}-report.json`), JSON.stringify(report, null, 1));
console.log(summarize(report));
const slowestStep = Object.entries(timing.steps).sort((a, b) => b[1] - a[1])[0];
console.log(
  `Timing: slowest step "${slowestStep[0]}" ${(slowestStep[1] / 1000).toFixed(1)} s (limit ${STEP_TIMEOUT_MS / 1000} s); ` +
    `slowest command ${timing.slowestCommand.method} ${timing.slowestCommand.ms} ms during ${timing.slowestCommand.during} (limit ${COMMAND_TIMEOUT_MS / 1000} s).`,
);
console.log(`\nScreenshots and ${args.label}-report.json are in ${OUT_DIR}/`);
process.exit(0);
