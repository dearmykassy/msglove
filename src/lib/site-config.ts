import type { Metadata } from "next";

// Static exports need their public origin at build time. Keep it source-controlled
// so a preview or CI environment cannot emit canonical or social URLs for another host.
export const SITE_ORIGIN = "https://msglove.kr";

export const INDEXABLE_ROBOTS = { index: true, follow: true } as const;

export function absoluteUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_ORIGIN}${normalized}`;
}

export function fixedPageMetadata({
  route,
  title,
  description,
  openGraphType = "website",
}: {
  route: string;
  title: string;
  description: string;
  openGraphType?: "website" | "article";
}): Metadata {
  const canonical = absoluteUrl(route);
  const socialTitle = route === "/" ? title : `${title} · 마사지러브`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: openGraphType,
      title: socialTitle,
      description,
      url: canonical,
      siteName: "마사지러브",
      locale: "ko_KR",
    },
    twitter: {
      card: "summary",
      title: socialTitle,
      description,
    },
  };
}
