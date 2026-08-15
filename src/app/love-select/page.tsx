import Link from "next/link";
import { BUSINESS } from "@/data/business";
import { fixedPageMetadata } from "@/lib/site-config";
import { LOVE_SELECT_COPY } from "@/lib/visible-content";

export const metadata = fixedPageMetadata({
  route: "/love-select/",
  title: LOVE_SELECT_COPY.metadataTitle,
  description: LOVE_SELECT_COPY.metadataDescription,
});

export default function LoveSelectPage() {
  return (
    <main className="editorial-page">
      <section className="page-shell editorial-hero">
        <span className="eyebrow">{LOVE_SELECT_COPY.eyebrow}</span>
        <h1>{LOVE_SELECT_COPY.h1}</h1>
        <p>{LOVE_SELECT_COPY.heroParagraph}</p>
      </section>
      <section className="page-shell editorial-content">
        <div className="editorial-guide-grid">
          {LOVE_SELECT_COPY.sections.map((section) => (
            <article key={section.heading}>
              <span>{section.eyebrow}</span>
              <h2>{section.heading}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </article>
          ))}
        </div>
        <div className="editorial-actions">
          <Link className="text-button" href="/pricing/">
            {LOVE_SELECT_COPY.pricingCta} <span>↗</span>
          </Link>
          <a className="primary-button" href={BUSINESS.phoneHref}>
            {LOVE_SELECT_COPY.phoneCta}
          </a>
        </div>
      </section>
    </main>
  );
}
