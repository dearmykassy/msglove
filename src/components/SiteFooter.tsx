import Link from "next/link";
import { BUSINESS } from "@/data/business";
import { SITE_COPY } from "@/lib/visible-content";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-shell">
        <div>
          <span className="footer-mark">ML</span>
          <h2>{BUSINESS.brand}</h2>
          <p>{SITE_COPY.footerDescription}</p>
        </div>
        <div>
          <strong>{SITE_COPY.footerServiceHeading}</strong>
          <Link href="/areas/">지역 라운지</Link>
          <Link href="/pricing/">코스 라인업</Link>
          <Link href="/guide/">이용 방식</Link>
        </div>
        <div>
          <strong>{SITE_COPY.footerEditorialHeading}</strong>
          <Link href="/love-select/">러브 셀렉트</Link>
          <Link href="/evening-note/">이브닝 노트</Link>
          <Link href="/notice/">알림</Link>
        </div>
        <div>
          <strong>{SITE_COPY.footerPhoneHeading}</strong>
          <a className="footer-phone" href={BUSINESS.phoneHref}>
            {BUSINESS.phoneCtaLabel}
          </a>
          <span className="footer-phone-number">{BUSINESS.phoneDisplay}</span>
          <span>{BUSINESS.consultation}</span>
          <span>{BUSINESS.payment}</span>
        </div>
      </div>
    </footer>
  );
}
