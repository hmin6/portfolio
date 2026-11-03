import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
