import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const display = Instrument_Serif({
  variable: "--nf-display",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

const label = Space_Grotesk({
  variable: "--nf-label",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const mono = JetBrains_Mono({
  variable: "--nf-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

// SITE_URL (a custom domain) wins; Render sets RENDER_EXTERNAL_URL automatically.
const siteUrl = process.env.SITE_URL ?? process.env.RENDER_EXTERNAL_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Closet 404 — an ofrenda for the dead web",
  description:
    "A walk-in closet of websites that went dark. Real Wayback Machine snapshots, read aloud by an open-weight Gemma ghost.",
};

export const viewport: Viewport = {
  themeColor: "#0c0b0e",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${label.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
