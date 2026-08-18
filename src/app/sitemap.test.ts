import { describe, expect, it } from "vitest";
import sitemap, {
  FIXED_ROUTE_LAST_MODIFIED,
  REGIONAL_LAST_MODIFIED,
} from "@/app/sitemap";
import { BLOG_POSTS } from "@/data/blog";
import { ACTIVE_REGION_NODES } from "@/lib/regions";
import { absoluteUrl } from "@/lib/site-config";

describe("static sitemap projection", () => {
  it("contains ten fixed pages and all 1,291 active region pages", () => {
    const entries = sitemap();
    expect(entries).toHaveLength(1301);
    expect(new Set(entries.map((entry) => entry.url)).size).toBe(1301);
    expect(entries.map((entry) => entry.url)).toEqual(
      expect.arrayContaining([
        "https://msglove.kr/blog/",
        "https://msglove.kr/blog/masaji-shop-gagi-himdeul-ttae/",
        "https://msglove.kr/blog/jibeseo-masaji-badeul-su-issnayo/",
        "https://msglove.kr/notice/",
      ]),
    );
  });

  it("does not include development-only regional roots", () => {
    const text = JSON.stringify(sitemap());
    for (const slug of [
      "gwangju-jeonnam",
      "ulsan",
      "sejong",
      "gangwon",
      "chungbuk",
      "chungnam",
      "jeonbuk",
      "gyeongbuk",
      "gyeongnam",
    ]) {
      expect(text).not.toContain(`/areas/${slug}/`);
    }
  });

  it("emits one stable, parseable, non-future lastmod for every canonical URL", () => {
    const first = sitemap();
    const second = sitemap();
    const normalize = (entries: ReturnType<typeof sitemap>) => entries.map((entry) => ({
      ...entry,
      lastModified: entry.lastModified instanceof Date
        ? entry.lastModified.toISOString()
        : entry.lastModified,
    }));

    expect(normalize(first)).toEqual(normalize(second));
    for (const entry of first) {
      expect(Object.keys(entry).sort()).toEqual(["lastModified", "url"]);
      expect(entry.lastModified).toBeInstanceOf(Date);
      const timestamp = (entry.lastModified as Date).valueOf();
      expect(Number.isFinite(timestamp)).toBe(true);
      expect(timestamp).toBeLessThanOrEqual(Date.now());
      expect(entry).not.toHaveProperty("priority");
      expect(entry).not.toHaveProperty("changeFrequency");
    }
  });

  it("uses exact route-group revision facts and each blog post modifiedAt", () => {
    const entries = new Map(sitemap().map((entry) => [entry.url, entry.lastModified]));

    for (const [route, lastModified] of Object.entries(FIXED_ROUTE_LAST_MODIFIED)) {
      expect(entries.get(absoluteUrl(route))).toEqual(new Date(lastModified));
    }
    for (const post of BLOG_POSTS) {
      expect(entries.get(absoluteUrl(post.route))).toEqual(new Date(post.modifiedAt));
    }
    for (const region of ACTIVE_REGION_NODES) {
      expect(entries.get(absoluteUrl(`${region.path}/`))).toEqual(new Date(REGIONAL_LAST_MODIFIED));
    }
  });
});
