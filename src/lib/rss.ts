export type RssFeedItem = {
  title: string;
  url: string;
  description: string;
  publishedAt: string;
  modifiedAt?: string;
  category?: string;
};

type RssFeedOptions = {
  title: string;
  siteUrl: string;
  feedUrl: string;
  description: string;
  language: "ko-KR";
  items: readonly RssFeedItem[];
};

export function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function parseDate(value: string, field: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    throw new Error(`RSS_INVALID_${field.toUpperCase()}`);
  }
  return date;
}

function validateCanonicalUrl(value: string, siteOrigin: string): URL {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.origin !== siteOrigin ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw new Error("RSS_NON_CANONICAL_OR_CROSS_ORIGIN_URL");
  }
  return url;
}

export function buildRssXml(options: RssFeedOptions): string {
  const site = new URL(options.siteUrl);
  const siteOrigin = site.origin;
  validateCanonicalUrl(options.siteUrl, siteOrigin);
  validateCanonicalUrl(options.feedUrl, siteOrigin);

  if (options.items.length === 0) {
    throw new Error("RSS_REQUIRES_AT_LEAST_ONE_ITEM");
  }

  const seenUrls = new Set<string>();
  const items = [...options.items]
    .map((item) => {
      const url = validateCanonicalUrl(item.url, siteOrigin).toString();
      if (seenUrls.has(url)) {
        throw new Error("RSS_DUPLICATE_ITEM_URL");
      }
      seenUrls.add(url);

      const publishedAt = parseDate(item.publishedAt, "published_at");
      const modifiedAt = parseDate(
        item.modifiedAt ?? item.publishedAt,
        "modified_at",
      );
      if (modifiedAt < publishedAt) {
        throw new Error("RSS_MODIFIED_BEFORE_PUBLISHED");
      }

      return { ...item, url, publishedAt, modifiedAt };
    })
    .sort(
      (left, right) =>
        right.modifiedAt.valueOf() - left.modifiedAt.valueOf() ||
        left.url.localeCompare(right.url),
    );

  const lastBuildDate = new Date(
    Math.max(...items.map((item) => item.modifiedAt.valueOf())),
  ).toUTCString();
  const itemXml = items
    .map(
      (item) => `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.url)}</link>
      <description>${escapeXml(item.description)}</description>
      <pubDate>${item.publishedAt.toUTCString()}</pubDate>
      <guid isPermaLink="true">${escapeXml(item.url)}</guid>${
        item.category
          ? `\n      <category>${escapeXml(item.category)}</category>`
          : ""
      }
    </item>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(options.title)}</title>
    <link>${escapeXml(options.siteUrl)}</link>
    <description>${escapeXml(options.description)}</description>
    <language>${options.language}</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${escapeXml(options.feedUrl)}" rel="self" type="application/rss+xml" />
${itemXml}
  </channel>
</rss>
`;
}
