import type { MetadataRoute } from "next";
import { BLOG_POSTS } from "@/data/blog";
import { ACTIVE_REGION_NODES } from "@/lib/regions";
import { absoluteUrl } from "@/lib/site-config";

const FIXED_ROUTES = [
  "/",
  "/areas/",
  "/guide/",
  "/pricing/",
  "/love-select/",
  "/evening-note/",
  "/notice/",
  "/blog/",
  ...BLOG_POSTS.map((post) => post.route),
] as const;

export const dynamic = "force-static";
export const revalidate = false;

export default function sitemap(): MetadataRoute.Sitemap {
  const fixed = FIXED_ROUTES.map((route) => ({
    url: absoluteUrl(route),
    changeFrequency: "weekly" as const,
    priority: route === "/" ? 1 : 0.7,
  }));
  const regions = ACTIVE_REGION_NODES.map((node) => ({
    url: absoluteUrl(`${node.path}/`),
    changeFrequency: "monthly" as const,
    priority: node.kind === "root" ? 0.9 : node.kind === "hub" ? 0.8 : 0.65,
  }));
  return [...fixed, ...regions];
}
