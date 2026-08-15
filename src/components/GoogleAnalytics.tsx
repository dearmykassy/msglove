"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

import {
  buildPageViewParams,
  buildPhoneCtaEventParams,
  GA_CONFIG_PARAMS,
  normalizeGaMeasurementId,
  PHONE_CTA_EVENT_NAME,
} from "@/lib/analytics";

type Gtag = (
  command: "config" | "event" | "js",
  targetOrDate: string | Date,
  params?: Record<string, unknown>,
) => void;

type AnalyticsState = {
  configuredIds: Set<string>;
  lastPagePathById: Map<string, string>;
};

declare global {
  interface Window {
    dataLayer?: IArguments[];
    gtag?: Gtag;
    __siteAnalyticsState?: AnalyticsState;
  }
}

function getAnalyticsState(): AnalyticsState {
  window.__siteAnalyticsState ??= {
    configuredIds: new Set<string>(),
    lastPagePathById: new Map<string, string>(),
  };

  return window.__siteAnalyticsState;
}

function configureGtag(measurementId: string): Gtag {
  window.dataLayer ??= [];
  window.gtag ??= function gtag() {
    window.dataLayer?.push(arguments);
  };

  const state = getAnalyticsState();
  if (!state.configuredIds.has(measurementId)) {
    window.gtag("js", new Date());
    window.gtag("config", measurementId, GA_CONFIG_PARAMS);
    state.configuredIds.add(measurementId);
  }

  return window.gtag;
}

export function GoogleAnalytics({
  measurementId,
  platformId,
}: {
  measurementId: string;
  platformId: string;
}) {
  const pathname = usePathname();
  const safeMeasurementId = normalizeGaMeasurementId(measurementId);

  useEffect(() => {
    if (!safeMeasurementId) return;

    const pageParams = buildPageViewParams(platformId, pathname ?? "/", {
      origin: window.location.origin,
      title: document.title,
    });
    const state = getAnalyticsState();
    if (state.lastPagePathById.get(safeMeasurementId) === pageParams.page_path) {
      return;
    }

    configureGtag(safeMeasurementId)("event", "page_view", pageParams);
    state.lastPagePathById.set(safeMeasurementId, pageParams.page_path);
  }, [pathname, platformId, safeMeasurementId]);

  useEffect(() => {
    if (!safeMeasurementId) return;

    const trackTelephoneLink = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;

      const link = event.target.closest<HTMLAnchorElement>("a[href]");
      const href = link?.getAttribute("href");
      if (!link || !href?.trim().toLowerCase().startsWith("tel:")) return;

      const params = buildPhoneCtaEventParams({
        platformId,
        path: window.location.pathname,
        dataLocation: link.dataset.analyticsLocation,
        textContent: link.textContent,
        context: {
          origin: window.location.origin,
          title: document.title,
        },
      });

      configureGtag(safeMeasurementId)("event", PHONE_CTA_EVENT_NAME, params);
    };

    document.addEventListener("click", trackTelephoneLink, true);
    return () => document.removeEventListener("click", trackTelephoneLink, true);
  }, [platformId, safeMeasurementId]);

  if (!safeMeasurementId) return null;

  return (
    <Script
      id={`ga4-loader-${safeMeasurementId}`}
      src={`https://www.googletagmanager.com/gtag/js?id=${safeMeasurementId}`}
      strategy="afterInteractive"
    />
  );
}
