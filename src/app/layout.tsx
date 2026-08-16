import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { BUSINESS } from "@/data/business";
import { normalizeGaMeasurementId } from "@/lib/analytics";
import { INDEXABLE_ROBOTS, SITE_ORIGIN } from "@/lib/site-config";
import { SITE_COPY } from "@/lib/visible-content";
import "./globals.css";

const GA_MEASUREMENT_ID = normalizeGaMeasurementId(
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
);

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: {
    default: SITE_COPY.defaultTitle,
    template: "%s · 마사지러브",
  },
  description: SITE_COPY.defaultDescription,
  applicationName: BUSINESS.brand,
  icons: {
    icon: "/favicon.svg",
  },
  robots: INDEXABLE_ROBOTS,
  verification: {
    other: {
      "naver-site-verification":
        "5c888aa8349db333cbd916cfa37312d5bfe59dca",
    },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#321a20",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <SiteHeader />
        {children}
        <SiteFooter />
        {GA_MEASUREMENT_ID ? (
          <Suspense fallback={null}>
            <GoogleAnalytics
              measurementId={GA_MEASUREMENT_ID}
              platformId={BUSINESS.platformId}
            />
          </Suspense>
        ) : null}
      </body>
    </html>
  );
}
