import Link from "next/link";
import { PriceLedger } from "@/components/PriceLedger";
import { RegionDirectory } from "@/components/RegionDirectory";
import { ReleasedHeaderStyle, ReleasedHeroPicture } from "@/components/ReleasedHero";
import { createRegionContent } from "@/lib/region-content";
import { getBreadcrumbs, type RegionNode } from "@/lib/regions";

const FACTS = [
  ["타이 60분 기준", "80,000원부터"],
  ["전화상담", "24시간"],
  ["선입금 없이", "100% 현장 후불"],
  ["현장 결제", "카드 가능"],
] as const;

export function RegionPage({ node }: { node: RegionNode }) {
  const content = createRegionContent(node);
  const breadcrumbs = getBreadcrumbs(node);
  const phoneHref = content.exactShared.contact.telHref;

  return (
    <main className="region-landing">
      <ReleasedHeaderStyle route={node.path} />
      <section className="region-hero" aria-labelledby="region-landing-title">
        <div className="region-hero-art" aria-hidden="true">
          <ReleasedHeroPicture route={node.path} />
          <span />
          <span />
          <span />
        </div>
        <div className="page-shell region-hero-inner">
          <nav className="breadcrumbs" aria-label="현재 위치">
            <Link href="/">홈</Link>
            {breadcrumbs.map((crumb) => (
              <span key={crumb.path}>
                <i>/</i>
                <Link href={crumb.path}>{crumb.name}</Link>
              </span>
            ))}
          </nav>
          <div className="region-hero-copy">
            <span className="eyebrow">{content.fields.eyebrow}</span>
            <h1 id="region-landing-title">{content.fields.h1}</h1>
            <p>{content.heroLead}</p>
            <div className="hero-actions">
              <a
                className="primary-button"
                data-analytics-location="region_hero"
                href={phoneHref}
              >
                전화상담
              </a>
              <a className="text-button" href="#region-pricing">
                코스·가격 보기 <span>↘</span>
              </a>
            </div>
          </div>
          <dl className="region-fact-strip" aria-label={`${node.displayName} 이용 핵심 정보`}>
            {FACTS.map(([term, value]) => (
              <div key={term}>
                <dt>{term}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <nav className="region-jump" aria-label="페이지 바로가기">
        <div className="page-shell">
          <a href="#region-directory">{node.kind === "representative" ? "포함 행정동" : "하위 지역"}</a>
          <a href="#region-introduction">지역 소개</a>
          <a href="#region-payment">안심 후불제</a>
          <a href="#region-pricing">코스·가격</a>
          <a href="#region-course-choice">코스 선택</a>
          <a href="#region-consultation">전화 전 준비</a>
          <a href="#region-standards">운영 기준</a>
          <a href="#region-process">이용 절차</a>
          <a href="#region-faq">자주 묻는 내용</a>
        </div>
      </nav>

      <div className="page-shell region-body">
        <div id="region-directory">
          <RegionDirectory node={node} />
        </div>

        <section className="region-introduction" id="region-introduction">
          <div className="section-heading horizontal">
            <div>
              <span>{content.introduction.eyebrow}</span>
              <h2>{content.introduction.title}</h2>
            </div>
            <p>{content.introduction.paragraphs[0]}</p>
          </div>
          <div className="regional-copy-columns">
            {content.introduction.paragraphs.slice(1).map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </section>

        <section className="payment-principle" id="region-payment">
          <div>
            <span>{content.trust.eyebrow}</span>
            <h2>{content.trust.title}</h2>
            {content.trust.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            <ul className="regional-trust-points">
              {content.trust.points.map((point) => <li key={point}>{point}</li>)}
            </ul>
          </div>
          <div className="principle-stamp" aria-label="현장 후불 원칙">
            <strong>NO</strong>
            <span>ADVANCE<br />DEPOSIT</span>
          </div>
        </section>

        <section className="course-section" id="region-pricing">
          <div className="section-heading horizontal">
            <div>
              <span>코스·가격</span>
              <h2>{content.pricing.heading}</h2>
            </div>
            <p>{content.pricing.note}</p>
          </div>
          <PriceLedger pricing={content.exactShared.pricing} />
          <p className="regional-call-prompt">{content.pricing.callPrompt}</p>
        </section>

        <section className="course-choice" id="region-course-choice">
          <div className="section-heading horizontal">
            <div>
              <span>코스 선택</span>
              <h2>{content.courseChoice.title}</h2>
            </div>
            <p>{content.courseChoice.lead}</p>
          </div>
          <ol className="course-choice-grid">
            {content.courseChoice.items.map((item, index) => (
              <li key={item.courseId}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
                <a href={`#course-${item.courseId}`}>{item.linkLabel}</a>
              </li>
            ))}
          </ol>
        </section>

        <section className="consultation-desk" id="region-consultation">
          <div className="section-heading">
            <span>전화 전 준비</span>
            <h2>{content.consultation.title}</h2>
          </div>
          <div className="desk-layout">
            <div className="desk-copy">
              <p>{content.consultation.lead}</p>
              {content.exactShared.consultationItems.map((item) => (
                <p key={item.index}><strong>{item.title}</strong> · {item.description}</p>
              ))}
            </div>
            <aside>
              <span>전화상담</span>
              <ol>
                {content.exactShared.consultationItems.map((item) => (
                  <li key={item.index}>{item.title}</li>
                ))}
              </ol>
              <p>{content.consultation.phonePrompt}</p>
              <a data-analytics-location="region_consultation" href={phoneHref}>
                전화상담
              </a>
            </aside>
          </div>
        </section>

        <section className="service-standards" id="region-standards">
          <div className="section-heading horizontal">
            <div>
              <span>운영 기준</span>
              <h2>{content.standards.title}</h2>
            </div>
            <p>{content.standards.lead}</p>
          </div>
          <div className="standards-grid">
            {content.exactShared.serviceStandards.map((item) => (
              <article key={item.label}>
                <span>{item.label}</span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="process-section" id="region-process">
          <div className="section-heading">
            <span>이용 절차</span>
            <h2>{content.process.title}</h2>
          </div>
          <div className="process-grid process-grid-five">
            {content.exactShared.processSteps.map((step, index) => (
              <article key={step.title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="region-faq" id="region-faq">
          <div className="section-heading">
            <span>자주 묻는 내용</span>
            <h2>{node.displayName} {content.faq.title}</h2>
          </div>
          <div className="faq-list">
            {content.faq.items.map((item) => (
              <details key={item.question}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </div>

      <a
        aria-label={`${content.exactShared.contact.display}으로 전화상담`}
        className="region-phone-fab"
        data-analytics-location="region_floating"
        href={phoneHref}
      >
        <span aria-hidden="true">☎</span>
        <strong>전화상담</strong>
      </a>
    </main>
  );
}
