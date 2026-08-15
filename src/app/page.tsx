import { PriceLedger } from "@/components/PriceLedger";
import { RootRegionGrid } from "@/components/RootRegionGrid";
import { BUSINESS } from "@/data/business";
import { fixedPageMetadata } from "@/lib/site-config";
import { HOME_COPY } from "@/lib/visible-content";

const APPROVED_HOME_HERO = {
  src: "/images/massage-love-home/v1/home-hero-openai-v1.png",
  width: 1672,
  height: 941,
  sha256: "67e2041de462dcc08381f6b7cba41ab50ab836730891e8b814ce206197533579",
} as const;

export const metadata = fixedPageMetadata({
  route: "/",
  title: HOME_COPY.metadataTitle,
  description: HOME_COPY.metadataDescription,
  keywords: HOME_COPY.metadataKeywords,
  absoluteTitle: true,
});

export default function HomePage() {
  return (
    <main className="home-page">
      <section className="home-hero" data-home-hero-contract="MLV-HOME-OPENAI-001">
        <div className="home-hero-image" aria-hidden="true">
          <img
            src={APPROVED_HOME_HERO.src}
            width={APPROVED_HOME_HERO.width}
            height={APPROVED_HOME_HERO.height}
            alt=""
            decoding="async"
            fetchPriority="high"
            data-asset-id="MLV-HOME-001"
            data-asset-sha256={APPROVED_HOME_HERO.sha256}
          />
        </div>
        <div className="page-shell home-hero-inner">
          <div className="home-hero-copy">
            <span className="eyebrow">{HOME_COPY.eyebrow}</span>
            <h1>{HOME_COPY.h1}</h1>
            <p>{HOME_COPY.heroParagraph}</p>
            <div className="home-hero-actions">
              <a className="home-primary-button" href="#home-region-search">
                {HOME_COPY.primaryCta}
                <span aria-hidden="true">→</span>
              </a>
              <a className="home-secondary-button" href={BUSINESS.phoneHref}>
                {HOME_COPY.secondaryCta}
              </a>
            </div>
          </div>
          <ul className="home-hero-facts" aria-label="운영 안내">
            {HOME_COPY.heroFacts.map((fact, index) => (
              <li key={fact}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{fact}</strong>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="home-region-section" id="regions" aria-labelledby="home-regions-title">
        <div className="page-shell">
          <form
            className="home-region-search"
            id="home-region-search"
            action="/areas/"
            method="get"
          >
            <div>
              <span>{HOME_COPY.searchEyebrow}</span>
              <h2>{HOME_COPY.searchHeading}</h2>
            </div>
            <label>
              <span className="sr-only">지역명 검색</span>
              <i aria-hidden="true" />
              <input
                type="search"
                name="region"
                placeholder={HOME_COPY.searchPlaceholder}
                autoComplete="off"
              />
            </label>
            <button type="submit">
              {HOME_COPY.primaryCta}
              <span aria-hidden="true">→</span>
            </button>
          </form>
          <div className="home-section-heading">
            <div>
              <span>{HOME_COPY.regionEyebrow}</span>
              <h2 id="home-regions-title">{HOME_COPY.regionHeading}</h2>
            </div>
            <p>{HOME_COPY.regionParagraph}</p>
          </div>
          <RootRegionGrid variant="home" cardLabel={HOME_COPY.regionCardLabel} />
          <a
            className="home-region-photo-credits"
            href="/images/massage-love-root-regions/v1/provenance.json"
          >
            지역 사진 출처 및 라이선스
          </a>
        </div>
      </section>

      <section className="home-principles" aria-labelledby="home-principles-title">
        <div className="page-shell home-principles-layout">
          <div>
            <span>{HOME_COPY.principleEyebrow}</span>
            <h2 id="home-principles-title">{HOME_COPY.principleHeading}</h2>
          </div>
          <ol className="home-principles-list">
            {HOME_COPY.principles.map((item, index) => (
              <li key={item.title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="home-pricing-section" id="pricing" aria-labelledby="home-pricing-title">
        <div className="page-shell">
          <div className="home-pricing-heading">
            <div>
              <span>{HOME_COPY.pricingEyebrow}</span>
              <h2 id="home-pricing-title">{HOME_COPY.pricingHeading}</h2>
            </div>
            <p>{HOME_COPY.pricingParagraph}</p>
          </div>
          <PriceLedger compact />
          <div className="home-pricing-callout">
            <span>{BUSINESS.consultation}</span>
            <a href={BUSINESS.phoneHref}>{HOME_COPY.pricingCta}</a>
          </div>
        </div>
      </section>
    </main>
  );
}
