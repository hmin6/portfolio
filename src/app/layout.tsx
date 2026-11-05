import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import SiteFooter from "@/components/layout/SiteFooter";
import SiteHeader from "@/components/layout/SiteHeader";
import "./globals.css";

// next/font downloads these at build time and serves them from this site,
// so visitors' browsers never contact Google. Both are variable fonts, so no
// weights need to be listed. `variable` names the CSS variable that
// globals.css maps to the `font-sans` and `font-heading` utilities.
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  // Optical size: adjusts letter shapes for large headings vs. small text.
  axes: ["opsz"],
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Harrison Min",
  description:
    "Portfolio of Harrison Min, focused on backend (Spring Boot, PostgreSQL) and data science.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/*
          Skip link: the first thing Tab reaches, so keyboard users can jump
          past the header to the page. Visually hidden until focused.
        */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-full focus:bg-starlight focus:px-4 focus:font-medium focus:text-night"
        >
          Skip to content
        </a>
        <SiteHeader />
        {/*
          tabIndex={-1} lets the skip link move focus here (not just scroll),
          so the next Tab continues from the page. It's a container, not a
          control, so it gets no focus ring.
        */}
        <main id="main" tabIndex={-1} className="flex-1 focus:outline-none focus-visible:shadow-none">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
