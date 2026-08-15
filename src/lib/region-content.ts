import snapshotJson from "@/data/region-content.generated.json";
import { REGION_SHARED_EXACT } from "@/lib/region-shared-content";
import {
  ACTIVE_REGION_NODES,
  getKeywordRegionLabel,
  type RegionNode,
} from "@/lib/regions";

export type RegionalPriceCourse = {
  id: string;
  name: string;
  description: string;
  options: readonly { readonly minutes: number; readonly priceKrw: number }[];
};

type TextSection = {
  eyebrow: string;
  title: string;
  paragraphs: string[];
};

type SnapshotRegionContent = {
  platformId: "massage-love";
  route: string;
  pageType: "region-root" | "region-hub" | "region-representative";
  regionId: string;
  regionName: string;
  regionAliases: string[];
  keywordPrefixes: string[];
  commercialName: string;
  localityLabel: string;
  fields: {
    title: string;
    description: string;
    keywords: string[];
    h1: string;
    eyebrow: string;
    ctaLabels: string[];
  };
  heroLead: string;
  directory: {
    title: string;
    lead: string;
    coverageTitle: string;
    coverageLead: string;
  };
  introduction: TextSection;
  trust: TextSection & { points: string[] };
  pricing: {
    heading: string;
    note: string;
    courseDescriptions: Record<string, string>;
    guideTitle: string;
    guideItems: string[];
    callPrompt: string;
  };
  courseChoice: {
    title: string;
    lead: string;
    items: Array<{
      courseId: string;
      title: string;
      description: string;
      linkLabel: string;
    }>;
  };
  consultation: {
    title: string;
    lead: string;
    itemDescriptions: string[];
    phonePrompt: string;
  };
  standards: {
    title: string;
    lead: string;
    itemDescriptions: string[];
    safetyTitle: string;
    safetyDescription: string;
  };
  process: { title: string; itemDescriptions: string[] };
  faq: { title: string; items: Array<{ question: string; answer: string }> };
};

type Snapshot = {
  schemaVersion: "massage-love-region-content/v2";
  source: { routeCount: number; routeDigest: string };
  entries: SnapshotRegionContent[];
};

export type RegionContent = Omit<SnapshotRegionContent, "fields"> & {
  fields: SnapshotRegionContent["fields"] & {
    headings: string[];
    paragraphs: string[];
  };
  exactShared: typeof REGION_SHARED_EXACT;
};

export const REGION_KEYWORD_SUFFIXES = [
  "출장마사지",
  "출장안마",
  "출장타이마사지",
  "출장스웨디시",
  "출장홈타이",
  "토닥이",
  "남성전용마사지",
  "여성전용마사지",
] as const;

const snapshot = snapshotJson as unknown as Snapshot;

function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

function assertSnapshot(): void {
  if (
    snapshot.schemaVersion !== "massage-love-region-content/v2" ||
    snapshot.source.routeCount !== 1291 ||
    snapshot.entries.length !== 1291
  ) {
    throw new Error("MASSAGE_LOVE_REGION_SNAPSHOT_INTEGRITY_FAILURE");
  }

  const sourceByRoute = new Map(snapshot.entries.map((entry) => [entry.route, entry]));
  if (sourceByRoute.size !== 1291 || !unique(snapshot.entries.map((entry) => entry.route))) {
    throw new Error("MASSAGE_LOVE_REGION_SNAPSHOT_ROUTE_DUPLICATE");
  }
  const titles = snapshot.entries.map((entry) => entry.fields.title);
  const descriptions = snapshot.entries.map((entry) => entry.fields.description);
  const h1Values = snapshot.entries.map((entry) => entry.fields.h1);
  const monikers = snapshot.entries.map((entry) => entry.commercialName);
  if (!unique(titles) || !unique(descriptions) || !unique(h1Values) || !unique(monikers)) {
    throw new Error("MASSAGE_LOVE_REGION_SNAPSHOT_UNIQUENESS_FAILURE");
  }

  const serialized = JSON.stringify(snapshot.entries);
  for (const forbidden of [
    "마사지봄",
    "[object Object]",
    "이용 정보를 따라",
    "마사지러브 안내를 기준으로",
    "지역 안내에서",
  ]) {
    if (serialized.includes(forbidden)) {
      throw new Error(`MASSAGE_LOVE_REGION_SNAPSHOT_FORBIDDEN:${forbidden}`);
    }
  }

  for (const node of ACTIVE_REGION_NODES) {
    const entry = sourceByRoute.get(node.path);
    if (!entry) throw new Error(`MASSAGE_LOVE_REGION_SNAPSHOT_MISSING:${node.path}`);
    const expectedKeywords = REGION_KEYWORD_SUFFIXES.map(
      (suffix) => `${getKeywordRegionLabel(node)}${suffix}`,
    );
    if (
      entry.fields.keywords.length !== expectedKeywords.length ||
      entry.fields.keywords.some((keyword, index) => keyword !== expectedKeywords[index]) ||
      entry.fields.h1 !== entry.commercialName ||
      entry.faq.items.length !== 7 ||
      REGION_SHARED_EXACT.contact.display !== "0508-202-3906" ||
      REGION_SHARED_EXACT.contact.telHref !== "tel:05082023906" ||
      REGION_SHARED_EXACT.pricing.reduce(
        (count, course) => count + course.options.length,
        0,
      ) !== 14
    ) {
      throw new Error(`MASSAGE_LOVE_REGION_SNAPSHOT_FIELD_INVALID:${node.path}`);
    }
  }
}

assertSnapshot();

function materializeRuntimeContent(entry: SnapshotRegionContent): RegionContent {
  return {
    ...entry,
    fields: {
      ...entry.fields,
      headings: [
        entry.directory.title,
        entry.introduction.title,
        entry.trust.title,
        entry.pricing.heading,
        entry.courseChoice.title,
        entry.consultation.title,
        entry.standards.title,
        entry.process.title,
        `${entry.regionName} ${entry.faq.title}`,
      ],
      paragraphs: [
        entry.heroLead,
        ...entry.introduction.paragraphs,
        ...entry.trust.paragraphs,
      ],
    },
    exactShared: REGION_SHARED_EXACT,
  };
}

export const REGION_CONTENT: RegionContent[] = snapshot.entries.map(
  materializeRuntimeContent,
);

export const REGION_CONTENT_BY_ROUTE = new Map(
  REGION_CONTENT.map((content) => [content.route, content]),
);

export function createRegionContent(node: RegionNode): RegionContent {
  const content = REGION_CONTENT_BY_ROUTE.get(node.path);
  if (!content) throw new Error(`MASSAGE_LOVE_REGION_CONTENT_MISSING:${node.path}`);
  return content;
}
