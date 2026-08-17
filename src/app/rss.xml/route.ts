import { BLOG_POSTS } from "@/data/blog";
import { buildRssXml } from "@/lib/rss";
import { absoluteUrl } from "@/lib/site-config";

export const dynamic = "force-static";
export const revalidate = false;

export function buildMassageLoveRss(): string {
  return buildRssXml({
    title: "마사지러브 블로그",
    siteUrl: absoluteUrl("/"),
    feedUrl: absoluteUrl("/rss.xml"),
    description:
      "마사지러브의 지역 확인, 전화상담 준비, 방문형 이용 전 체크 항목을 정리한 실용 안내입니다.",
    language: "ko-KR",
    items: BLOG_POSTS.map((post) => ({
      title: post.metadataTitle,
      url: absoluteUrl(post.route),
      description: [
        post.heroParagraph,
        post.consultationHeading,
        ...post.consultationItems,
        ...post.sections.flatMap((section) => [
          section.heading,
          ...section.paragraphs,
        ]),
      ].join("\n\n"),
      publishedAt: post.publishedAt,
      modifiedAt: post.modifiedAt,
      category: "방문 상담 안내",
    })),
  });
}

export function GET(): Response {
  return new Response(buildMassageLoveRss(), {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
