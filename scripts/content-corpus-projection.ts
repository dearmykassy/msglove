import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { REGION_CONTENT } from "../src/lib/region-content";
import {
  buildSourceRouteVisibleContracts,
  type SourceRouteVisibleContract,
} from "../src/lib/rendered-route-contract";
import { FIXED_VISIBLE_CONTENT } from "../src/lib/visible-content";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const CONTENT_SOURCE_FILES = [
  "scripts/content-corpus-projection.ts",
  "scripts/generate-content-artifacts.ts",
  "scripts/sync-massagebom-region-baseline.ts",
  "src/data/region-content.generated.json",
  "src/lib/region-content.ts",
  "src/lib/region-shared-content.ts",
  "src/lib/regions.ts",
  "src/lib/content-quality.ts",
  "src/lib/rendered-route-contract.tsx",
  "src/lib/visible-content.ts",
  "src/components/PriceLedger.tsx",
  "src/components/RegionDirectory.tsx",
  "src/components/RegionPage.tsx",
  "src/app/areas/[...segments]/page.tsx",
  "src/app/globals.css",
] as const;

export type CompactRouteVisibleContract = {
  route: string;
  pageType: string;
  sourceMarkupSha256: string;
  contractSha256: string;
  occurrenceCount: number;
  uniqueEntryCount: number;
};

export type CompactContentCorpus = {
  schemaVersion: "massage-love-content-corpus/v2";
  platformId: "massage-love";
  brand: "마사지러브";
  status: "COMPLETE";
  counts: Record<string, number>;
  sourceManifest: Array<{ path: string; sha256: string }>;
  sourceManifestSha256: string;
  sourceProjectionSha256: string;
  sharedExact: { path: string; sha256: string; scope: readonly string[] };
  entries: Array<Omit<(typeof REGION_CONTENT)[number], "exactShared">>;
  fixedEntries: typeof FIXED_VISIBLE_CONTENT;
  routeVisibleContracts: CompactRouteVisibleContract[];
  renderingContract: Record<string, unknown>;
};

export function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export function stableCompact(value: unknown): string {
  const normalize = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(normalize);
    if (input && typeof input === "object") {
      return Object.fromEntries(
        Object.entries(input as Record<string, unknown>)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, child]) => [key, normalize(child)]),
      );
    }
    return input;
  };
  return JSON.stringify(normalize(value));
}

function compactRouteContracts(
  contracts: readonly SourceRouteVisibleContract[],
): CompactRouteVisibleContract[] {
  return contracts.map((entry) => ({
    route: entry.route,
    pageType: entry.pageType,
    sourceMarkupSha256: entry.sourceMarkupSha256,
    contractSha256: entry.contract.digestSha256,
    occurrenceCount: entry.contract.occurrenceCount,
    uniqueEntryCount: entry.contract.uniqueEntryCount,
  }));
}

async function sourceManifest() {
  return Promise.all(
    CONTENT_SOURCE_FILES.map(async (relativePath) => ({
      path: relativePath,
      sha256: sha256(await readFile(path.join(projectRoot, relativePath))),
    })),
  ).then((files) => files.sort((left, right) => left.path.localeCompare(right.path)));
}

export async function buildCompactContentCorpus(
  sourceContracts: readonly SourceRouteVisibleContract[] = buildSourceRouteVisibleContracts(),
): Promise<CompactContentCorpus> {
  const expectedVisibleRouteCount =
    REGION_CONTENT.length +
    FIXED_VISIBLE_CONTENT.filter((entry) => entry.route !== "__site-common__").length;
  if (
    REGION_CONTENT.length !== 1291 ||
    sourceContracts.length !== expectedVisibleRouteCount
  ) {
    throw new Error("MASSAGE_LOVE_CONTENT_CORPUS_SOURCE_COUNT_INVALID");
  }

  // `exactShared` and the full DOM contract used to be repeated 1,291 times.
  // Keep their source binding once at the top level; the runtime still owns the
  // exact phone/payment/price data in `region-shared-content.ts`.
  const entries = REGION_CONTENT.map((content) => {
    const { exactShared, ...entry } = content;
    void exactShared;
    return entry;
  });
  const routeVisibleContracts = compactRouteContracts(sourceContracts);
  const sourceFiles = await sourceManifest();
  const sharedExact = {
    path: "src/lib/region-shared-content.ts",
    sha256:
      sourceFiles.find((entry) => entry.path === "src/lib/region-shared-content.ts")?.sha256 ??
      "",
    scope: ["phone", "14-price-rows", "payment-facts"] as const,
  };
  if (!sharedExact.sha256) throw new Error("MASSAGE_LOVE_SHARED_SOURCE_MISSING");

  const sourceManifestSha256 = sha256(stableCompact(sourceFiles));
  const sourceProjectionSha256 = sha256(
    stableCompact({
      entries,
      fixedEntries: FIXED_VISIBLE_CONTENT,
      routeVisibleContracts,
      sourceManifestSha256,
      sharedExact,
    }),
  );

  return {
    schemaVersion: "massage-love-content-corpus/v2",
    platformId: "massage-love",
    brand: "마사지러브",
    status: "COMPLETE",
    counts: {
      documents: entries.length,
      fixedDocuments: FIXED_VISIBLE_CONTENT.length,
      totalVisibleDocuments: entries.length + FIXED_VISIBLE_CONTENT.length,
      routeVisibleContracts: routeVisibleContracts.length,
      routeVisibleOccurrences: routeVisibleContracts.reduce(
        (count, entry) => count + entry.occurrenceCount,
        0,
      ),
      keywords: entries.reduce((count, entry) => count + entry.fields.keywords.length, 0),
    },
    sourceManifest: sourceFiles,
    sourceManifestSha256,
    sourceProjectionSha256,
    sharedExact,
    entries,
    fixedEntries: FIXED_VISIBLE_CONTENT,
    routeVisibleContracts,
    renderingContract: {
      status: "COMPACT_SOURCE_PROJECTION",
      fullVisibleContracts: "constructed in memory by verify-built-visible-contract.ts",
      repeatedExactShared: false,
      repeatedVisibleContract: false,
    },
  };
}
