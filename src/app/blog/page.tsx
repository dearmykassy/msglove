import Link from "@/components/SiteLink";
import { BLOG_HUB_COPY, BLOG_POSTS } from "@/data/blog";
import { fixedPageMetadata } from "@/lib/site-config";

export const metadata = fixedPageMetadata({
  route: "/blog/",
  title: BLOG_HUB_COPY.metadataTitle,
  description: BLOG_HUB_COPY.metadataDescription,
});

export default function BlogHubPage() {
  return (
    <main className="blog-page blog-hub-page">
      <section className="blog-hero">
        <div className="page-shell blog-hero-inner">
          <span className="eyebrow">{BLOG_HUB_COPY.eyebrow}</span>
          <h1>{BLOG_HUB_COPY.h1}</h1>
          <p>{BLOG_HUB_COPY.heroParagraph}</p>
        </div>
      </section>
      <section className="page-shell blog-board" aria-labelledby="blog-board-title">
        <div className="blog-board-heading">
          <div>
            <span>{BLOG_HUB_COPY.listEyebrow}</span>
            <h2 id="blog-board-title">{BLOG_HUB_COPY.listHeading}</h2>
          </div>
          <p>{BLOG_HUB_COPY.listParagraph}</p>
        </div>
        <div className="blog-card-list">
          {BLOG_POSTS.map((post) => (
            <article key={post.slug}>
              <span>{String(post.order).padStart(2, "0")}</span>
              <div>
                <small>{post.eyebrow}</small>
                <h3>{post.cardTitle}</h3>
                <p>{post.metadataDescription}</p>
              </div>
              <Link href={post.route}>
                {BLOG_HUB_COPY.readCta} <i aria-hidden="true">↗</i>
              </Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
