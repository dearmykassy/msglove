import type { Metadata, Viewport } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { BUSINESS } from "@/data/business";
import { INDEXABLE_ROBOTS, SITE_ORIGIN } from "@/lib/site-config";
import { SITE_COPY } from "@/lib/visible-content";
import "./globals.css";

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
      </body>
    </html>
  );
}
