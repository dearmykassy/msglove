import { PriceLedger } from "@/components/PriceLedger";
import { BUSINESS } from "@/data/business";
import { fixedPageMetadata } from "@/lib/site-config";
import { PRICING_COPY } from "@/lib/visible-content";

export const metadata = fixedPageMetadata({
  route: "/pricing/",
  title: PRICING_COPY.metadataTitle,
  description: PRICING_COPY.metadataDescription,
});

export default function PricingPage() {
  return (
    <main className="simple-page love-fixed-page love-fixed-pricing">
      <section className="simple-hero love-fixed-hero">
        <div className="page-shell love-fixed-hero-inner">
          <span className="eyebrow">{PRICING_COPY.eyebrow}</span>
          <h1>{PRICING_COPY.h1}</h1>
          <p>{PRICING_COPY.heroParagraph}</p>
        </div>
      </section>
      <section className="page-shell simple-content love-fixed-content" aria-labelledby="pricing-ledger-heading">
        <div className="section-heading simple-section-heading love-fixed-heading">
          <span>{PRICING_COPY.ledgerEyebrow}</span>
          <h2 id="pricing-ledger-heading">{PRICING_COPY.ledgerHeading}</h2>
          <p>{PRICING_COPY.ledgerParagraph}</p>
        </div>
        <PriceLedger compact />
        <div className="pricing-callout love-fixed-callout">
          <div>
            <span>{PRICING_COPY.calloutEyebrow}</span>
            <h2>{PRICING_COPY.calloutHeading}</h2>
            <p>{PRICING_COPY.calloutParagraph}</p>
          </div>
          <a className="primary-button" href={BUSINESS.phoneHref}>
            {BUSINESS.phoneCtaLabel}
          </a>
        </div>
      </section>
    </main>
  );
}
