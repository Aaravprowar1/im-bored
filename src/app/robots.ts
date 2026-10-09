import type { MetadataRoute } from "next";
import { publicConfig } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/profile", "/settings", "/submit/status/", "/auth/"] }],
    sitemap: `${publicConfig.siteUrl}/sitemap.xml`,
  };
}
