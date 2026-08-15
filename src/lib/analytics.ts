const GA_MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]{6,20}$/;
const PLATFORM_ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;
const CTA_LOCATION_PATTERN = /^[a-z][a-z_]{0,63}$/;
const PHONE_LIKE_PATTERN = /(?:\+?\d[\s().-]*){8,}/g;
const EMAIL_PATTERN = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/giu;

export const PHONE_CTA_EVENT_NAME = "phone_cta_clicked";
export const GA_CONFIG_PARAMS = {
  send_page_view: false,
  allow_google_signals: false,
  allow_ad_personalization_signals: false,
} as const;

export type AnalyticsParams = Record<string, string>;

export function normalizeGaMeasurementId(value: string | undefined): string | null {
  const candidate = value?.trim().toUpperCase();

  return candidate && GA_MEASUREMENT_ID_PATTERN.test(candidate)
    ? candidate
    : null;
}

function normalizePlatformId(value: string): string {
  const candidate = value.trim().toLowerCase();

  return PLATFORM_ID_PATTERN.test(candidate) ? candidate : "unknown-platform";
}

export function normalizePagePath(value: string): string {
  const pathname = value.split(/[?#]/, 1)[0] || "/";
  const withLeadingSlash = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const withoutTrailingSlash =
    withLeadingSlash.length > 1 ? withLeadingSlash.replace(/\/+$/, "") : withLeadingSlash;

  let decodedPath = withoutTrailingSlash;
  try {
    decodedPath = decodeURIComponent(withoutTrailingSlash);
  } catch {
    // Keep the encoded pathname when it is not valid URI data.
  }

  const redactedPath = decodedPath
    .replace(PHONE_LIKE_PATTERN, "[redacted]")
    .replace(/[^/]*@[^/]*/g, "[redacted]");

  return redactedPath.slice(0, 256) || "/";
}

export function normalizePageTitle(value: string): string {
  const redactedTitle = value
    .replace(PHONE_LIKE_PATTERN, "[redacted]")
    .replace(EMAIL_PATTERN, "[redacted]")
    .replace(/\s+/g, " ")
    .trim();

  return redactedTitle.slice(0, 150) || "Untitled page";
}

function normalizePageOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : null;
  } catch {
    return null;
  }
}

export function inferPageType(path: string): string | undefined {
  const pagePath = normalizePagePath(path);

  if (pagePath === "/") return "home";
  if (pagePath === "/areas") return "area_directory";
  if (pagePath.startsWith("/areas/")) return "region";
  if (pagePath === "/blog") return "blog_index";
  if (pagePath.startsWith("/blog/")) return "blog_post";
  if (pagePath === "/pricing") return "pricing";
  if (pagePath === "/guide") return "guide";
  if (pagePath === "/notice") return "notice";
  if (
    pagePath === "/love-select" ||
    pagePath === "/evening-note" ||
    pagePath === "/image-credits"
  ) {
    return "editorial";
  }

  return undefined;
}

export function deriveCtaLocation(
  dataLocation: string | undefined,
  textContent: string | null,
): string {
  const declaredLocation = dataLocation?.trim().toLowerCase();
  if (declaredLocation && CTA_LOCATION_PATTERN.test(declaredLocation)) {
    return declaredLocation;
  }

  const label = textContent?.replace(/\s+/g, " ").trim() ?? "";
  if (label.includes("전화상담")) return "phone_consultation";
  if (label.includes("상담")) return "consultation";
  if (label.includes("전화")) return "phone";

  return "tel_link";
}

export function buildPageViewParams(
  platformId: string,
  path: string,
  context?: { origin: string; title: string },
): AnalyticsParams {
  const pagePath = normalizePagePath(path);
  const pageType = inferPageType(pagePath);
  const pageOrigin = context ? normalizePageOrigin(context.origin) : null;

  return {
    platform_id: normalizePlatformId(platformId),
    page_path: pagePath,
    ...(pageType ? { page_type: pageType } : {}),
    ...(pageOrigin ? { page_location: `${pageOrigin}${pagePath}` } : {}),
    ...(context ? { page_title: normalizePageTitle(context.title) } : {}),
  };
}

export function buildPhoneCtaEventParams({
  platformId,
  path,
  dataLocation,
  textContent,
  context,
}: {
  platformId: string;
  path: string;
  dataLocation?: string;
  textContent: string | null;
  context?: { origin: string; title: string };
}): AnalyticsParams {
  return {
    ...buildPageViewParams(platformId, path, context),
    cta_location: deriveCtaLocation(dataLocation, textContent),
    transport_type: "beacon",
  };
}
