import Link from "next/link";
import { BLOG_POSTS, type BlogPost } from "@/data/blog";
import { BUSINESS } from "@/data/business";
import { absoluteUrl } from "@/lib/site-config";

function relatedPostFor(post: BlogPost): BlogPost {
  const related = BLOG_POSTS.find((candidate) => candidate.slug !== post.slug);
  if (!related) throw new Error("MASSAGE_LOVE_BLOG_RELATED_POST_MISSING");
  return related;
}

export function blogPostingJsonLd(post: BlogPost) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.h1,
    description: post.metadataDescription,
    inLanguage: "ko-KR",
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": absoluteUrl(post.route),
    },
    url: absoluteUrl(post.route),
    isPartOf: {
      "@type": "Blog",
      name: "마사지러브 블로그",
      url: absoluteUrl("/blog/"),
    },
    publisher: {
      "@type": "Organization",
      name: "마사지러브",
    },
  };
}

export function BlogPostArticle({ post }: { post: BlogPost }) {
  const related = relatedPostFor(post);

  return (
    <main className="blog-page blog-post-page">
      <section className="blog-hero blog-post-hero">
        <div className="page-shell blog-hero-inner">
          <nav className="blog-breadcrumbs" aria-label="블로그 경로">
            <Link href="/">홈</Link>
            <span aria-hidden="true">/</span>
            <Link href="/blog/">블로그</Link>
            <span aria-hidden="true">/</span>
            <span>{post.cardTitle}</span>
          </nav>
          <span className="eyebrow">{post.eyebrow}</span>
          <h1>{post.h1}</h1>
          <p>{post.heroParagraph}</p>
        </div>
      </section>

      <article className="page-shell blog-article">
        <aside className="blog-article-rail" aria-label="전화상담 전 확인">
          <span>CALL NOTE</span>
          <h2>{post.consultationHeading}</h2>
          <ol>
            {post.consultationItems.map((item, index) => (
              <li key={item}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <p>{item}</p>
              </li>
            ))}
          </ol>
        </aside>
        <div className="blog-article-body">
          {post.sections.map((section) => (
            <section key={section.heading}>
              <h2>{section.heading}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>
          ))}
        </div>
      </article>

      <section className="page-shell blog-action-panel" aria-labelledby={`${post.slug}-actions`}>
        <div>
          <span>CHECK NEXT</span>
          <h2 id={`${post.slug}-actions`}>지역과 상담 조건을 차례로 확인하세요</h2>
          <p>지역 안내에서 서비스를 받을 곳을 찾은 뒤, 정확한 주소와 희망 조건을 전화상담으로 확인할 수 있습니다.</p>
        </div>
        <div className="blog-action-links">
          <Link className="text-button" href="/areas/">
            지역 안내 <span>↗</span>
          </Link>
          <a
            className="primary-button"
            data-analytics-location="blog_action"
            href={BUSINESS.phoneHref}
          >
            {BUSINESS.phoneCtaLabel}
          </a>
        </div>
      </section>

      <nav className="page-shell blog-related" aria-label="관련 글">
        <span>RELATED READING</span>
        <Link href={related.route}>
          <strong>{related.cardTitle}</strong>
          <small>관련 글 읽기 <i aria-hidden="true">→</i></small>
        </Link>
      </nav>
    </main>
  );
}
