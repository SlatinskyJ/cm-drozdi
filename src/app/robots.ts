import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/events/"],
    },
    sitemap: "https://cmdrozdi.cz/sitemap.xml",
  };
}
