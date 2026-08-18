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
] as const;

// Pinned to the latest commit that materially changed each page. These are
// content revision facts, not deploy/build timestamps.
export const FIXED_ROUTE_LAST_MODIFIED = {
  "/": "2026-08-15T14:14:44+09:00", // 3ffeec0e — home metadata/region presentation
  "/areas/": "2026-08-15T13:13:24+09:00", // dc5054db — production launch
  "/guide/": "2026-08-15T13:13:24+09:00", // dc5054db — production launch
  "/pricing/": "2026-08-15T13:13:24+09:00", // dc5054db — production launch
  "/love-select/": "2026-08-15T13:13:24+09:00", // dc5054db — production launch
  "/evening-note/": "2026-08-15T13:13:24+09:00", // dc5054db — production launch
  "/notice/": "2026-08-15T13:13:24+09:00", // dc5054db — production launch
  "/blog/": "2026-08-15T13:13:24+09:00", // dc5054db — production launch
} as const;

// 6f94fd69 is the shared 2026-08-19 regional search-metadata revision.
export const REGIONAL_LAST_MODIFIED = "2026-08-19T00:50:53+09:00";

export const dynamic = "force-static";
export const revalidate = false;

export default function sitemap(): MetadataRoute.Sitemap {
  const fixed = FIXED_ROUTES.map((route) => ({
    url: absoluteUrl(route),
    lastModified: new Date(FIXED_ROUTE_LAST_MODIFIED[route]),
  }));
  const blog = BLOG_POSTS.map((post) => ({
    url: absoluteUrl(post.route),
    lastModified: new Date(post.modifiedAt),
  }));
  const regions = ACTIVE_REGION_NODES.map((node) => ({
    url: absoluteUrl(`${node.path}/`),
    lastModified: new Date(REGIONAL_LAST_MODIFIED),
  }));
  return [...fixed, ...blog, ...regions];
}
