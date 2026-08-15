import {
  REGION_CONTENT,
  REGION_KEYWORD_SUFFIXES,
  type RegionContent,
} from "@/lib/region-content";
import { ACTIVE_REGION_NODES, getKeywordRegionLabel } from "@/lib/regions";
import {
  buildSourceRouteVisibleContracts,
  type SourceRouteVisibleContract,
} from "@/lib/rendered-route-contract";
import { FIXED_VISIBLE_CONTENT } from "@/lib/visible-content";

const FORBIDDEN_SNAPSHOT_TEXT = [
  "마사지봄",
  "[object Object]",
  "이용 정보를 따라",
  "마사지러브 안내를 기준으로",
  "지역 안내에서",
] as const;

const EXPECTED_PRICES = [
  ["타이마사지", 60, 80_000],
  ["타이마사지", 90, 100_000],
  ["타이마사지", 120, 120_000],
  ["아로마마사지", 60, 90_000],
  ["아로마마사지", 90, 110_000],
  ["아로마마사지", 120, 130_000],
  ["힐링마사지", 60, 100_000],
  ["힐링마사지", 90, 120_000],
  ["힐링마사지", 120, 140_000],
  ["스페셜마사지", 60, 110_000],
  ["스페셜마사지", 90, 130_000],
  ["스페셜마사지", 120, 150_000],
  ["남성전용", 60, 120_000],
  ["남성전용", 90, 150_000],
] as const;

function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

function allVisibleStrings(content: RegionContent): string[] {
  return [
    content.fields.title,
    content.fields.description,
    content.fields.h1,
    content.fields.eyebrow,
    content.heroLead,
    ...content.fields.headings,
    ...content.fields.paragraphs,
    content.directory.title,
    content.directory.lead,
    content.directory.coverageTitle,
    content.directory.coverageLead,
    content.introduction.eyebrow,
    content.introduction.title,
    ...content.introduction.paragraphs,
    content.trust.eyebrow,
    content.trust.title,
    ...content.trust.paragraphs,
    ...content.trust.points,
    content.pricing.heading,
    content.pricing.note,
    ...Object.values(content.pricing.courseDescriptions),
    content.pricing.guideTitle,
    ...content.pricing.guideItems,
    content.pricing.callPrompt,
    content.courseChoice.title,
    content.courseChoice.lead,
    ...content.courseChoice.items.flatMap((item) => [item.title, item.description, item.linkLabel]),
    content.consultation.title,
    content.consultation.lead,
    ...content.consultation.itemDescriptions,
    content.consultation.phonePrompt,
    content.standards.title,
    content.standards.lead,
    ...content.standards.itemDescriptions,
    content.standards.safetyTitle,
    content.standards.safetyDescription,
    content.process.title,
    ...content.process.itemDescriptions,
    content.faq.title,
    ...content.faq.items.flatMap((item) => [item.question, item.answer]),
  ];
}

function expectedPriceRows(content: RegionContent): Array<readonly [string, number, number]> {
  return content.exactShared.pricing.flatMap((course) =>
    course.options.map(
      (option) => [course.name, option.minutes, option.priceKrw] as const,
    ),
  );
}

export function buildContentQualityReceipt(
  routeVisibleContracts: SourceRouteVisibleContract[] = buildSourceRouteVisibleContracts(),
) {
  const titles = REGION_CONTENT.map((content) => content.fields.title);
  const descriptions = REGION_CONTENT.map((content) => content.fields.description);
  const h1Values = REGION_CONTENT.map((content) => content.fields.h1);
  const monikers = REGION_CONTENT.map((content) => content.commercialName);
  const routeSet = new Set(REGION_CONTENT.map((content) => content.route));
  const contentViolations: string[] = [];

  if (REGION_CONTENT.length !== 1291 || routeSet.size !== 1291) {
    contentViolations.push("ROUTE_COUNT_OR_DUPLICATE");
  }
  if (!unique(titles)) contentViolations.push("TITLE_DUPLICATE");
  if (!unique(descriptions)) contentViolations.push("DESCRIPTION_DUPLICATE");
  if (!unique(h1Values)) contentViolations.push("H1_DUPLICATE");
  if (!unique(monikers)) contentViolations.push("COMMERCIAL_NAME_DUPLICATE");

  const forbiddenTextMatches = REGION_CONTENT.flatMap((content) => {
    const serialized = allVisibleStrings(content).join("\n");
    return FORBIDDEN_SNAPSHOT_TEXT.filter((phrase) => serialized.includes(phrase)).map(
      (phrase) => ({ route: content.route, phrase }),
    );
  });
  contentViolations.push(
    ...forbiddenTextMatches.map((entry) => `FORBIDDEN:${entry.route}:${entry.phrase}`),
  );

  const perRouteViolations = ACTIVE_REGION_NODES.flatMap((node) => {
    const content = REGION_CONTENT.find((entry) => entry.route === node.path);
    if (!content) return [`MISSING:${node.path}`];
    const expectedKeywords = REGION_KEYWORD_SUFFIXES.map(
      (suffix) => `${getKeywordRegionLabel(node)}${suffix}`,
    );
    const checks = [
      content.fields.keywords.length === 8 &&
        content.fields.keywords.every((value, index) => value === expectedKeywords[index]),
      content.fields.h1 === content.commercialName,
      content.faq.items.length === 7,
      content.exactShared.contact.display === "0508-202-3906" &&
        content.exactShared.contact.telHref === "tel:05082023906",
      JSON.stringify(expectedPriceRows(content)) === JSON.stringify(EXPECTED_PRICES),
      /^.+\s+\S+\s+(출장마사지|홈타이|타이마사지|스웨디시|마사지)$/u.test(
        content.commercialName,
      ),
    ];
    return checks.every(Boolean) ? [] : [`FIELD:${node.path}`];
  });
  contentViolations.push(...perRouteViolations);

  const builtRoutes = new Set(routeVisibleContracts.map((entry) => entry.route));
  const expectedVisibleRouteCount =
    REGION_CONTENT.length +
    FIXED_VISIBLE_CONTENT.filter((entry) => entry.route !== "__site-common__").length;
  if (
    routeVisibleContracts.length !== expectedVisibleRouteCount ||
    builtRoutes.size !== expectedVisibleRouteCount
  ) {
    contentViolations.push("SOURCE_VISIBLE_ROUTE_COUNT");
  }
  for (const content of REGION_CONTENT) {
    if (!builtRoutes.has(content.route)) contentViolations.push(`SOURCE_VISIBLE_MISSING:${content.route}`);
  }

  return {
    schemaVersion: "massage-love-content-quality/v2",
    platformId: "massage-love",
    status: contentViolations.length === 0 ? "PASS" : "FAIL",
    policy: {
      sameRouteMassageBomBaseline: true,
      strictPathJoin: true,
      exactShared: ["phone", "14-price-rows", "approved-q-and-a", "payment-facts"],
      adapted: ["title", "description", "h1", "introduction", "body", "commercial-name"],
      forbiddenWrapperPrefixes: FORBIDDEN_SNAPSHOT_TEXT.slice(2),
    },
    counts: {
      documents: REGION_CONTENT.length,
      titles: titles.length,
      descriptions: descriptions.length,
      h1: h1Values.length,
      commercialNames: monikers.length,
      keywords: REGION_CONTENT.reduce((count, content) => count + content.fields.keywords.length, 0),
      sourceVisibleRoutes: routeVisibleContracts.length,
      forbiddenTextMatches: forbiddenTextMatches.length,
    },
    rawUniqueness: {
      title: { total: titles.length, unique: new Set(titles).size },
      description: { total: descriptions.length, unique: new Set(descriptions).size },
      h1: { total: h1Values.length, unique: new Set(h1Values).size },
      commercialName: { total: monikers.length, unique: new Set(monikers).size },
    },
    forbiddenTextMatches,
    routeJoin: {
      expected: ACTIVE_REGION_NODES.length,
      actual: REGION_CONTENT.length,
      missing: ACTIVE_REGION_NODES.filter((node) => !routeSet.has(node.path)).map(
        (node) => node.path,
      ),
    },
    visibleContentCoverage: {
      routeVisibleContracts: routeVisibleContracts.length,
      routeVisibleOccurrences: routeVisibleContracts.reduce(
        (count, route) => count + route.contract.occurrenceCount,
        0,
      ),
    },
    violations: contentViolations,
  };
}
