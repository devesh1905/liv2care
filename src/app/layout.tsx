import type { Metadata, Viewport } from "next";
import { Manrope, Noto_Sans_Devanagari, Public_Sans } from "next/font/google";
import "./globals.css";

// Body text, headings, and Hindi (Devanagari) text for patient screens.
const publicSans = Public_Sans({ variable: "--font-public-sans", subsets: ["latin"] });
const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"], weight: ["600", "700", "800"] });
const devanagari = Noto_Sans_Devanagari({ variable: "--font-devanagari", subsets: ["devanagari"] });

export const metadata: Metadata = {
  title: { default: "Liv2care", template: "%s · Liv2care" },
  description:
    "An EHR-independent, closed-loop care-coordination platform for liver-risk assessment in people with type 2 diabetes.",
};

export const viewport: Viewport = { themeColor: "#0b63b6", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${publicSans.variable} ${manrope.variable} ${devanagari.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
