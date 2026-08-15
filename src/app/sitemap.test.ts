import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";

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
});
