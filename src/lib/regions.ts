import capitalRegionData from "@/data/capital-regions.generated.json";
import serviceCityRegionData from "@/data/service-city-regions.generated.json";

export const ACTIVE_ROOT_KEYS = [
  "seoul",
  "incheon",
  "gyeonggi",
  "cheonan",
  "asan",
  "daejeon",
  "daegu",
  "gumi",
  "pohang",
  "busan",
  "jeju",
] as const;

export type ActiveRootKey = (typeof ACTIVE_ROOT_KEYS)[number];

export type RegionRecord = {
  id: string;
  sidoKey: ActiveRootKey;
  sidoName: string;
  municipality: string;
  district: string | null;
  officialSigungu: string;
  name: string;
  groupType: string;
  reviewStatus: string;
  legalIdentityMode: string;
  sourceNames: string[];
  sourceCodes: string[];
  legalAreas: Array<{ code: string; name: string }>;
  pathSegments: string[];
  path: string;
};

type CapitalData = {
  schemaVersion: number;
  status: string;
  effectiveDate: string;
  sourceArtifactDigest: string;
  sourceRawSha256: string;
  counts: {
    originalAdminUnits: number;
    representativeRegions: number;
    seoul: number;
    gyeonggi: number;
    incheon: number;
  };
  regions: RegionRecord[];
};

type ServiceData = {
  schemaVersion: number;
  status: string;
  effectiveDate: string;
  sourceRawSha256: string;
  counts: {
    serviceCityRoots: number;
    intermediateHubs: number;
    sourceAdministrativeUnits: number;
    numberedSourceUnits: number;
    representativeFamilies: number;
    representativeRegions: number;
    activeRoutes: number;
  };
  regions: RegionRecord[];
};

export type RegionNodeKind = "root" | "hub" | "representative";

export type RegionNode = {
  id: string;
  kind: RegionNodeKind;
  rootKey: ActiveRootKey;
  segments: string[];
  path: string;
  displayName: string;
  qualifiedName: string;
  records: RegionRecord[];
  representative: RegionRecord | null;
  aliases: string[];
};

export type RegionChild = {
  kind: RegionNodeKind;
  name: string;
  path: string;
  representativeCount: number;
};

const capital = capitalRegionData as CapitalData;
const service = serviceCityRegionData as ServiceData;

if (
  capital.schemaVersion !== 1 ||
  capital.status !== "COMMITTED" ||
  capital.counts.originalAdminUnits !== 1187 ||
  capital.counts.representativeRegions !== 768 ||
  capital.regions.length !== 768
) {
  throw new Error("MASSAGE_LOVE_CAPITAL_REGION_SOURCE_INVALID");
}

if (
  service.schemaVersion !== 1 ||
  service.status !== "COMMITTED" ||
  service.effectiveDate !== "2026-07-20" ||
  service.counts.serviceCityRoots !== 8 ||
  service.counts.intermediateHubs !== 36 ||
  service.counts.sourceAdministrativeUnits !== 583 ||
  service.counts.numberedSourceUnits !== 309 ||
  service.counts.representativeFamilies !== 111 ||
  service.counts.representativeRegions !== 385 ||
  service.counts.activeRoutes !== 429 ||
  service.regions.length !== 385
) {
  throw new Error("MASSAGE_LOVE_SERVICE_REGION_SOURCE_INVALID");
}

export const REGION_EFFECTIVE_DATES = {
  capital: capital.effectiveDate,
  serviceCities: service.effectiveDate,
} as const;

export const REGIONS = [...capital.regions, ...service.regions];

export const ROOT_LABELS: Record<
  ActiveRootKey,
  { full: string; short: string; scope: string }
> = {
  seoul: { full: "서울특별시", short: "서울", scope: "25개 구" },
  incheon: { full: "인천광역시", short: "인천", scope: "군·구 전역" },
  gyeonggi: { full: "경기도", short: "경기", scope: "31개 시·군" },
  cheonan: { full: "천안시", short: "천안", scope: "2개 구" },
  asan: { full: "아산시", short: "아산", scope: "12개 지역" },
  daejeon: { full: "대전광역시", short: "대전", scope: "5개 구" },
  daegu: { full: "대구광역시", short: "대구", scope: "9개 군·구" },
  gumi: { full: "구미시", short: "구미", scope: "23개 지역" },
  pohang: { full: "포항시", short: "포항", scope: "2개 구" },
  busan: { full: "부산광역시", short: "부산", scope: "16개 군·구" },
  jeju: { full: "제주특별자치도", short: "제주", scope: "2개 행정시" },
};

const ROOT_ORDER = new Map(ACTIVE_ROOT_KEYS.map((key, index) => [key, index]));

function canonicalSegments(segments: readonly string[]): string[] {
  return segments.map((segment) => {
    try {
      return decodeURIComponent(segment).normalize("NFC");
    } catch {
      return segment.normalize("NFC");
    }
  });
}

function hasPrefix(record: RegionRecord, segments: readonly string[]): boolean {
  return segments.every((segment, index) => record.pathSegments[index] === segment);
}

export function buildRegionPath(segments: readonly string[]): string {
  return `/areas/${segments.map((segment) => encodeURIComponent(segment)).join("/")}`;
}

function keyForSegments(segments: readonly string[]): string {
  return segments.join("\u001f");
}

const PATH_SEGMENTS = new Map<string, string[]>();

for (const rootKey of ACTIVE_ROOT_KEYS) {
  PATH_SEGMENTS.set(keyForSegments([rootKey]), [rootKey]);
}

for (const record of REGIONS) {
  for (let length = 1; length <= record.pathSegments.length; length += 1) {
    const segments = record.pathSegments.slice(0, length);
    PATH_SEGMENTS.set(keyForSegments(segments), segments);
  }
}

function nodeForSegments(segmentsInput: readonly string[]): RegionNode | null {
  const segments = canonicalSegments(segmentsInput);
  const rootKey = segments[0] as ActiveRootKey;
  if (!ROOT_ORDER.has(rootKey) || segments.length === 0 || segments.length > 4) {
    return null;
  }

  const records = REGIONS.filter((record) => hasPrefix(record, segments));
  if (records.length === 0) return null;

  const representative =
    records.find((record) => record.pathSegments.length === segments.length) ?? null;
  const kind: RegionNodeKind =
    segments.length === 1
      ? "root"
      : representative
        ? "representative"
        : "hub";
  const displayName =
    kind === "root" ? ROOT_LABELS[rootKey].full : (segments.at(-1) ?? "지역");
  const qualifiedParts = [ROOT_LABELS[rootKey].full, ...segments.slice(1)];

  return {
    id: `mlv-region-${segments.map(encodeURIComponent).join("-")}`,
    kind,
    rootKey,
    segments,
    path: buildRegionPath(segments),
    displayName,
    qualifiedName: qualifiedParts.join(" "),
    records,
    representative,
    aliases: representative ? [...new Set(representative.sourceNames)] : [],
  };
}

export function resolveRegionNode(segments: readonly string[]): RegionNode | null {
  return nodeForSegments(segments);
}

export const ACTIVE_REGION_NODES: RegionNode[] = [...PATH_SEGMENTS.values()]
  .map((segments) => nodeForSegments(segments))
  .filter((node): node is RegionNode => node !== null)
  .sort(
    (left, right) =>
      (ROOT_ORDER.get(left.rootKey) ?? 99) -
        (ROOT_ORDER.get(right.rootKey) ?? 99) ||
      left.segments.length - right.segments.length ||
      left.path.localeCompare(right.path, "ko"),
  );

if (ACTIVE_REGION_NODES.length !== 1291) {
  throw new Error(
    `MASSAGE_LOVE_ACTIVE_ROUTE_COUNT_INVALID:${ACTIVE_REGION_NODES.length}`,
  );
}

const NODE_BY_KEY = new Map(
  ACTIVE_REGION_NODES.map((node) => [keyForSegments(node.segments), node]),
);

const DISPLAY_NAME_FREQUENCY = ACTIVE_REGION_NODES.reduce(
  (counts, node) => counts.set(node.displayName, (counts.get(node.displayName) ?? 0) + 1),
  new Map<string, number>(),
);

export function getKeywordRegionLabel(node: RegionNode): string {
  return (DISPLAY_NAME_FREQUENCY.get(node.displayName) ?? 0) > 1
    ? node.qualifiedName.replace(/\s+/g, "")
    : node.displayName;
}

export function getDirectChildren(node: RegionNode): RegionChild[] {
  if (node.kind === "representative") return [];
  const nextLength = node.segments.length + 1;

  return ACTIVE_REGION_NODES.filter(
    (candidate) =>
      candidate.segments.length === nextLength &&
      node.segments.every((segment, index) => candidate.segments[index] === segment),
  ).map((candidate) => ({
    kind: candidate.kind,
    name: candidate.displayName,
    path: candidate.path,
    representativeCount: candidate.records.length,
  }));
}

export function getBreadcrumbs(node: RegionNode): Array<{ name: string; path: string }> {
  const breadcrumbs = [{ name: "지역 라운지", path: "/areas/" }];
  for (let length = 1; length <= node.segments.length; length += 1) {
    const candidate = NODE_BY_KEY.get(keyForSegments(node.segments.slice(0, length)));
    if (candidate) breadcrumbs.push({ name: candidate.displayName, path: candidate.path });
  }
  return breadcrumbs;
}

export function getActiveStaticParams(): Array<{ segments: string[] }> {
  return ACTIVE_REGION_NODES.map((node) => ({ segments: node.segments }));
}

export function getRootNode(rootKey: ActiveRootKey): RegionNode {
  const node = NODE_BY_KEY.get(keyForSegments([rootKey]));
  if (!node) throw new Error(`MASSAGE_LOVE_ROOT_NOT_FOUND:${rootKey}`);
  return node;
}

export function getParentNode(node: RegionNode): RegionNode | null {
  if (node.segments.length === 1) return null;
  return NODE_BY_KEY.get(keyForSegments(node.segments.slice(0, -1))) ?? null;
}
