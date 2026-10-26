import type { Metadata, Viewport } from "next";

// Fonts ship inside the project (no download at build time, so a build never fails because Google Fonts was slow):
// Public Sans for body text, Manrope for headings, Noto Sans Devanagari for Hindi.
import "@fontsource-variable/public-sans";
import "@fontsource-variable/manrope";
import "@fontsource-variable/noto-sans-devanagari";
import "./globals.css";
import { Splash, splashScript } from "@/components/splash";

export const metadata: Metadata = {
  title: { default: "Liv2care", template: "%s · Liv2care" },
  description: "An EHR-independent, closed-loop care-coordination platform for liver-risk assessment in people with type 2 diabetes.",
};

export const viewport: Viewport = { themeColor: "#0b63b6", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The splash script sets data-splash on <html> before React starts, so React is told not to mind that attribute.
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: splashScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <Splash />
        {children}
      </body>
    </html>
  );
}
