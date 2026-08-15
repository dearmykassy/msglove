import { BUSINESS } from "@/data/business";
import { fixedPageMetadata } from "@/lib/site-config";
import { GUIDE_COPY } from "@/lib/visible-content";

export const metadata = fixedPageMetadata({
  route: "/guide/",
  title: GUIDE_COPY.metadataTitle,
  description: GUIDE_COPY.metadataDescription,
});

export default function GuidePage() {
  return (
    <main className="simple-page love-fixed-page love-fixed-guide">
      <section className="simple-hero love-fixed-hero">
        <div className="page-shell love-fixed-hero-inner">
          <span className="eyebrow">{GUIDE_COPY.eyebrow}</span>
          <h1>{GUIDE_COPY.h1}</h1>
          <p>{GUIDE_COPY.heroParagraph}</p>
        </div>
      </section>
      <section className="page-shell simple-content love-fixed-content">
        <div className="guide-timeline">
          {GUIDE_COPY.steps.map(([number, title, body]) => (
            <article key={number}>
              <span>{number}</span>
              <h2>{title}</h2>
              <p>{body}</p>
            </article>
          ))}
        </div>
        <div className="pricing-callout light-callout love-fixed-callout">
          <div>
            <span>{GUIDE_COPY.calloutEyebrow}</span>
            <h2>{GUIDE_COPY.calloutHeading}</h2>
            <p>{BUSINESS.consultation} · {BUSINESS.payment} · {BUSINESS.cardPayment}</p>
          </div>
          <a
            className="primary-button"
            data-analytics-location="guide_callout"
            href={BUSINESS.phoneHref}
          >
            {BUSINESS.phoneCtaLabel}
          </a>
        </div>
      </section>
    </main>
  );
}
