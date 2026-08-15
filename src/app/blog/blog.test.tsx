import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import BlogPostPage, {
  generateMetadata,
  generateStaticParams,
} from "@/app/blog/[slug]/page";
import BlogHubPage from "@/app/blog/page";
import NoticePage, { metadata as noticeMetadata } from "@/app/notice/page";
import { blogPostingJsonLd } from "@/components/BlogPostArticle";
import { SiteHeader } from "@/components/SiteHeader";
import { BLOG_POSTS, blogPostCharacterCount } from "@/data/blog";
import { BUSINESS } from "@/data/business";
import { absoluteUrl } from "@/lib/site-config";

const unsupportedOperationalClaims = [
  /도착(?:\s*(?:시간|예정))?/u,
  /ETA/iu,
  /배정/u,
  /출발/u,
] as const;

describe("마사지러브 블로그", () => {
  it("keeps two original practical posts within the requested length and claim boundary", () => {
    expect(BLOG_POSTS.map((post) => post.slug)).toEqual([
      "masaji-shop-gagi-himdeul-ttae",
      "jibeseo-masaji-badeul-su-issnayo",
    ]);
    expect(new Set(BLOG_POSTS.map((post) => post.metadataTitle)).size).toBe(2);
    expect(new Set(BLOG_POSTS.map((post) => post.metadataDescription)).size).toBe(2);
    expect(new Set(BLOG_POSTS.map((post) => post.h1)).size).toBe(2);

    for (const post of BLOG_POSTS) {
      const articleText = [
        post.heroParagraph,
        ...post.sections.flatMap((section) => [section.heading, ...section.paragraphs]),
      ].join("\n");
      expect(blogPostCharacterCount(post), post.slug).toBeGreaterThanOrEqual(900);
      expect(blogPostCharacterCount(post), post.slug).toBeLessThanOrEqual(1400);
      for (const claim of unsupportedOperationalClaims) {
        expect(articleText, `${post.slug}:${claim}`).not.toMatch(claim);
      }
    }
  });

  it("exposes blog and notices from both header navigations and connects hub, areas, phone, and related posts", async () => {
    const headerMarkup = renderToStaticMarkup(<SiteHeader />);
    expect((headerMarkup.match(/href="\/blog\/?"/gu) ?? [])).toHaveLength(2);
    expect((headerMarkup.match(/href="\/notice\/?"/gu) ?? [])).toHaveLength(2);

    const hubMarkup = renderToStaticMarkup(<BlogHubPage />);
    for (const post of BLOG_POSTS) {
      expect(hubMarkup).toContain(`href="${post.route.replace(/\/$/u, "")}"`);
    }

    for (const post of BLOG_POSTS) {
      const related = BLOG_POSTS.find((candidate) => candidate.slug !== post.slug);
      const page = await BlogPostPage({ params: Promise.resolve({ slug: post.slug }) });
      const markup = renderToStaticMarkup(page);
      expect(markup).toContain('href="/areas"');
      expect(markup).toContain(`href="${BUSINESS.phoneHref}"`);
      expect(markup).toContain(`href="${related?.route.replace(/\/$/u, "")}"`);
    }
  });

  it("renders a date-free notice board with only confirmed operating facts", () => {
    const markup = renderToStaticMarkup(<NoticePage />);
    expect((markup.match(/NOTICE 0[1-3]/gu) ?? [])).toHaveLength(3);
    expect(markup).toContain("24시간 전화상담");
    expect(markup).toContain("선입금 없는 현장 후불");
    expect(markup).toContain("현장 카드 결제");
    expect(markup).not.toMatch(/202[0-9]|\d{1,2}월\s*\d{1,2}일/u);
    expect(noticeMetadata.alternates?.canonical).toBe(absoluteUrl("/notice/"));
    expect(noticeMetadata.twitter).toMatchObject({ card: "summary" });
  });

  it("generates article metadata and BlogPosting JSON-LD for the production site", async () => {
    for (const post of BLOG_POSTS) {
      const metadata = await generateMetadata({ params: Promise.resolve({ slug: post.slug }) });
      const jsonLd = blogPostingJsonLd(post);
      expect(metadata.description).toBe(post.metadataDescription);
      expect(metadata.alternates?.canonical).toBe(absoluteUrl(post.route));
      expect(metadata.openGraph).toMatchObject({
        type: "article",
        title: `${post.metadataTitle} · 마사지러브`,
      });
      expect(metadata.twitter).toMatchObject({
        card: "summary",
        title: `${post.metadataTitle} · 마사지러브`,
      });
      expect(jsonLd).toMatchObject({
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: post.h1,
        description: post.metadataDescription,
        inLanguage: "ko-KR",
        url: absoluteUrl(post.route),
      });
      expect(jsonLd.mainEntityOfPage).toEqual({
        "@type": "WebPage",
        "@id": absoluteUrl(post.route),
      });
    }
    expect(generateStaticParams()).toEqual(
      BLOG_POSTS.map((post) => ({ slug: post.slug })),
    );
  });
});
