import Link from "@/components/SiteLink";
import { BUSINESS } from "@/data/business";
import { SITE_COPY } from "@/lib/visible-content";

function NavigationLinks() {
  return SITE_COPY.navigation.map((item) => (
    <Link key={item.href} href={item.href}>
      {item.label}
    </Link>
  ));
}

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="header-shell">
        <Link className="brand-lockup" href="/" aria-label={SITE_COPY.brandAriaLabel}>
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <strong>{BUSINESS.brand}</strong>
        </Link>
        <nav className="desktop-nav" aria-label={SITE_COPY.desktopNavigationAriaLabel}>
          <NavigationLinks />
        </nav>
        <a
          className="header-call"
          data-analytics-location="header"
          href={BUSINESS.phoneHref}
        >
          {BUSINESS.phoneCtaLabel}
        </a>
        <details className="mobile-menu">
          <summary>{SITE_COPY.mobileMenuLabel}</summary>
          <nav aria-label={SITE_COPY.mobileNavigationAriaLabel}>
            <NavigationLinks />
          </nav>
        </details>
      </div>
    </header>
  );
}
