import type { MetadataRoute } from "next";
import { publicConfig } from "@/lib/config";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/challenges", "/leaderboard", "/submit", "/about", "/privacy", "/terms", "/contact", "/login", "/signup"].map((path) => ({
    url: `${publicConfig.siteUrl}${path}`,
    changeFrequency: path === "" || path === "/challenges" || path === "/leaderboard" ? "daily" : "monthly",
    priority: path === "" ? 1 : 0.6,
  }));
}
