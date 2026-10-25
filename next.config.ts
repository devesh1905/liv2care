import type { NextConfig } from "next";

/**
 * Headers sent with every page. They stop the site being shown inside someone else's page (clickjacking), stop browsers
 * guessing file types, keep private links out of the Referer header sent to other sites, and switch off browser features
 * the app never uses. The Content-Security-Policy here only restricts framing, the base address, forms and plug-ins; it
 * leaves scripts alone because Next.js needs inline scripts and a stricter policy would need per-request nonces.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

// The patient's pages may ask for the phone's location (to drop a pin for a home visit); no other page may.
const sameOriginFrameHeaders = securityHeaders.map((h) =>
  h.key === "X-Frame-Options"
    ? { ...h, value: "SAMEORIGIN" }
    : h.key === "Content-Security-Policy"
      ? { ...h, value: h.value.replace("frame-ancestors 'none'", "frame-ancestors 'self'") }
      : h.key === "Permissions-Policy"
        ? { ...h, value: h.value.replace("geolocation=()", "geolocation=(self)") }
        : h,
);

const nextConfig: NextConfig = {
  cacheComponents: true,
  // A report is up to 5 MB; the default limit for a form submission is 1 MB, which would refuse most PDFs and photos.
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
  partialPrefetching: true,
  async headers() {
    return [
      // Staff pages and everything else may not be framed at all.
      { source: "/((?!book/|patient/).*)", headers: securityHeaders },
      // The patient's own pages may be framed by this site only: the "patient's phone" view shows them inside a phone.
      { source: "/:page(book|patient)/:path*", headers: sameOriginFrameHeaders },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
