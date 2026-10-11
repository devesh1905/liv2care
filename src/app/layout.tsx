import type { Metadata, Viewport } from "next";

// Fonts ship inside the project (no download at build time, so a build never fails because Google Fonts was slow):
// Public Sans for body text, Manrope for headings, Noto Sans Devanagari for Hindi.
import "@fontsource-variable/public-sans";
import "@fontsource-variable/manrope";
import "@fontsource-variable/noto-sans-devanagari";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Liv2care", template: "%s · Liv2care" },
  description:
    "An EHR-independent, closed-loop care-coordination platform for liver-risk assessment in people with type 2 diabetes.",
};

export const viewport: Viewport = { themeColor: "#0b63b6", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
