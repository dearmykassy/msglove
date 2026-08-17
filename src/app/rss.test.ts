import { describe, expect, it } from "vitest";
import { BLOG_POSTS } from "@/data/blog";
import { buildMassageLoveRss, GET } from "@/app/rss.xml/route";
import { buildRssXml, escapeXml } from "@/lib/rss";

describe("MassageLove RSS", () => {
  it("publishes complete canonical blog entries with stable real dates", async () => {
    const xml = buildMassageLoveRss();
    const response = GET();

    expect(response.headers.get("content-type")).toBe(
      "application/rss+xml; charset=utf-8",
    );
    expect(await response.text()).toBe(xml);
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain("<language>ko-KR</language>");
    expect(xml).toContain(
      'href="https://msglove.kr/rss.xml" rel="self" type="application/rss+xml"',
    );
    expect((xml.match(/<item>/g) ?? [])).toHaveLength(BLOG_POSTS.length);

    for (const post of BLOG_POSTS) {
      expect(xml).toContain(`<link>https://msglove.kr${post.route}</link>`);
      expect(xml).toContain(
        `<guid isPermaLink="true">https://msglove.kr${post.route}</guid>`,
      );
      expect(xml).toContain(escapeXml(post.heroParagraph));
      for (const section of post.sections) {
        expect(xml).toContain(escapeXml(section.heading));
        for (const paragraph of section.paragraphs) {
          expect(xml).toContain(escapeXml(paragraph));
        }
      }
      expect(xml).toContain(new Date(post.publishedAt).toUTCString());
    }
  });

  it("fails closed on empty, cross-origin URLs and unverified dates", () => {
    const base = {
      title: "마사지러브",
      siteUrl: "https://msglove.kr/",
      feedUrl: "https://msglove.kr/rss.xml",
      description: "설명",
      language: "ko-KR" as const,
    };
    const item = {
      title: "글",
      url: "https://msglove.kr/blog/one/",
      description: "본문 전체",
      publishedAt: "2026-08-15T13:13:24+09:00",
    };

    expect(() => buildRssXml({ ...base, items: [] })).toThrow();
    expect(() =>
      buildRssXml({
        ...base,
        items: [{ ...item, url: "https://example.com/post" }],
      }),
    ).toThrow();
    expect(() =>
      buildRssXml({ ...base, items: [{ ...item, publishedAt: "today" }] }),
    ).toThrow();
  });
});
