import type { MetadataRoute } from "next";

/** Keeps search engines on the public home page. Patient links and every staff page stay out of results. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/$",
      disallow: ["/book/", "/patient/", "/doctor", "/clinician", "/partner", "/ops", "/reports/", "/login", "/demo", "/api/"],
    },
  };
}
