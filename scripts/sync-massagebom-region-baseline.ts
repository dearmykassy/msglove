/**
 * Materialize MassageBom's live regional generators into a Love-owned,
 * transformed snapshot. This command is intentionally manual: normal Love
 * builds read only the committed JSON below and never require a sibling
 * MassageBom checkout.
 */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ACTIVE_REGION_NODES, getKeywordRegionLabel } from "../src/lib/regions";

type JsonRecord = Record<string, unknown>;

type BaselineEntry = {
  route: string;
  node: {
    kind: string;
    displayName: string;
    recordIds: string[];
    representative: { id: string; sourceNames: string[] } | null;
  };
  approved: {
    commercial_name: string;
    locality_label: string;
    page_heading: string;
  };
  seo: {
    metadata: { title: string; description: string };
    keywords: { all: Record<string, string>; primary: string; visible: string[] };
    hero: { heading: { text: string }; lead: { text: string } };
  };
  editorial: JsonRecord;
  customer: JsonRecord;
  exactShared: JsonRecord;
};

type BaselinePayload = {
  schemaVersion: number;
  source: string;
  sourceFiles: Record<string, string>;
  routeCount: number;
  entries: BaselineEntry[];
};

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.resolve(projectRoot, "..");
const massageBomRoot = [
  process.env.MASSAGEBOM_ROOT,
  path.join(workspaceRoot, "msgbom"),
  path.join(workspaceRoot, "massagebom"),
]
  .filter((candidate): candidate is string => typeof candidate === "string")
  .map((candidate) => path.resolve(candidate))
  .find(
    (candidate) =>
      existsSync(path.join(candidate, "tsconfig.json")) &&
      existsSync(path.join(candidate, "src", "lib", "region-seo-copy.ts")),
  );

if (!massageBomRoot) {
  throw new Error("MASSAGE_LOVE_MASSAGEBOM_ROOT_NOT_FOUND");
}

const runtomeRoot = [
  process.env.MASSAGEBOM_MATERIALIZER_ROOT,
  path.join(workspaceRoot, "runtome"),
  path.resolve(projectRoot, "..", "..", "Codex", "runtome"),
].find(
  (candidate): candidate is string =>
    typeof candidate === "string" &&
    existsSync(
      path.join(
        candidate,
        "pipeline",
        "massagebom-child-site-v1",
        "materialize-live-baseline.mts",
      ),
    ),
);

if (!runtomeRoot) {
  throw new Error("MASSAGE_LOVE_MATERIALIZER_NOT_FOUND");
}

const materializerPath = path.join(
  runtomeRoot,
  "pipeline",
  "massagebom-child-site-v1",
  "materialize-live-baseline.mts",
);
const massageBomTsconfigPath = path.join(massageBomRoot, "tsconfig.json");
const materializerArgs = [
  "--tsconfig",
  massageBomTsconfigPath,
  materializerPath,
  massageBomRoot,
] as const;
const loveTsxPath = path.join(projectRoot, "node_modules", ".bin", "tsx");
const materializerEnv = { ...process.env };

// `tsx` adds its own package paths when this script is launched through pnpm.
// Do not pass those resolver internals to the separately launched, Love-local
// runner; it must resolve the supplied MassageBom tsconfig on its own.
delete materializerEnv.NODE_PATH;

if (!existsSync(loveTsxPath)) {
  throw new Error("MASSAGE_LOVE_LOCAL_TSX_NOT_FOUND");
}

function materializeMassageBom(): string {
  const result = spawnSync(
    loveTsxPath,
    materializerArgs,
    {
      cwd: projectRoot,
      env: materializerEnv,
      encoding: "utf8",
      maxBuffer: 128 * 1024 * 1024,
    },
  );

  if (result.error) {
    throw new Error(`MASSAGE_LOVE_MATERIALIZER_EXEC_FAILED:${result.error.message}`);
  }
  if (result.status !== 0) {
    const stderr = typeof result.stderr === "string" ? result.stderr.trim() : "";
    throw new Error(`MASSAGE_LOVE_MATERIALIZER_FAILED:${result.status}:${stderr.slice(-1000)}`);
  }
  if (typeof result.stdout !== "string") {
    throw new Error("MASSAGE_LOVE_MATERIALIZER_OUTPUT_INVALID");
  }

  return result.stdout;
}

const snapshotPath = path.join(projectRoot, "src/data/region-content.generated.json");
const manifestPath = path.join(
  projectRoot,
  "artifacts/massagebom-region-baseline-manifest.v1.json",
);

const KEYWORD_SUFFIXES = [
  "출장마사지",
  "출장안마",
  "출장타이마사지",
  "출장스웨디시",
  "출장홈타이",
  "토닥이",
  "남성전용마사지",
  "여성전용마사지",
] as const;

const MONIKER_PREFIXES = [
  "온결",
  "다온",
  "담소",
  "온유",
  "정성",
  "라온",
  "마루",
  "여유",
  "고운",
  "편안",
  "늘봄",
  "온기",
  "한결",
  "다정",
  "소담",
  "바른",
  "이음",
  "온담",
  "해온",
  "새온",
  "여담",
  "고요",
  "담온",
  "온새",
] as const;

const MONIKER_SUFFIXES = [
  "출장마사지",
  "홈타이",
  "타이마사지",
  "스웨디시",
  "마사지",
] as const;

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function stableJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function stableHash(value: string): number {
  let hash = 0x811c9dc5;
  for (const char of value) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function pick<T>(route: string, slot: string, values: readonly T[]): T {
  return values[stableHash(`${route}\u0000${slot}`) % values.length] as T;
}

function asRecord(value: unknown, pathLabel: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`MASSAGE_LOVE_BASELINE_RECORD_INVALID:${pathLabel}`);
  }
  return value as JsonRecord;
}

function asStrings(value: unknown, pathLabel: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`MASSAGE_LOVE_BASELINE_STRING_ARRAY_INVALID:${pathLabel}`);
  }
  return [...value] as string[];
}

function rewriteText(
  input: string,
  route: string,
  slot: string,
  sourceCommercialName: string,
  loveCommercialName: string,
): string {
  const original = input.normalize("NFC").trim();
  const branded = original
    .replaceAll("마사지봄", "마사지러브")
    .replaceAll(sourceCommercialName, loveCommercialName);

  if (branded !== original) return branded;

  // Keep the MassageBom sentence as the semantic baseline. These are small,
  // grammatical substitutions only; no wrapper language or new claims.
  const substitutions: readonly [RegExp, readonly string[]][] = [
    [/확인해 주세요\.$/u, ["확인해 보세요."]],
    [/확인하세요\.$/u, ["살펴보세요."]],
    [/살펴보세요\.$/u, ["확인해 보세요."]],
    [/알려 주세요\.$/u, ["말씀해 주세요."]],
    [/알려주세요\.$/u, ["말씀해 주세요."]],
    [/정리했습니다\.$/u, ["정리해 두었습니다."]],
    [/안내합니다\.$/u, ["소개합니다."]],
    [/제공합니다\.$/u, ["이어갑니다."]],
    [/확인합니다\.$/u, ["확인해 드립니다."]],
    [/지킵니다\.$/u, ["유지합니다."]],
    [/진행합니다\.$/u, ["이어갑니다."]],
  ];
  for (const [pattern, replacements] of substitutions) {
    if (pattern.test(branded)) {
      return branded.replace(pattern, pick(route, `${slot}:ending`, replacements));
    }
  }

  const phraseSubstitutions: readonly [string, string][] = [
    ["먼저", "우선"],
    ["함께", "같이"],
    ["정확한", "분명한"],
    ["원하는", "희망하는"],
    ["차례로", "순서대로"],
    ["한 번", "다시 한번"],
  ];
  const candidates = phraseSubstitutions.filter(([from]) => branded.includes(from));
  if (candidates.length > 0) {
    const [from, to] = pick(route, `${slot}:phrase`, candidates);
    return branded.replace(from, to);
  }

  // Owner direction permits close same-route reuse where a forced rewrite
  // would make the Korean worse. The caller records this as a retained,
  // non-operational baseline string in the source manifest.
  if (branded.includes("마사지봄")) {
    throw new Error(`MASSAGE_LOVE_BRAND_LEAK:${route}:${slot}`);
  }
  return branded;
}

function rewriteValue(
  value: unknown,
  route: string,
  slot: string,
  sourceCommercialName: string,
  loveCommercialName: string,
): unknown {
  if (typeof value === "string") {
    return rewriteText(value, route, slot, sourceCommercialName, loveCommercialName);
  }
  if (Array.isArray(value)) {
    return value.map((item, index) =>
      rewriteValue(item, route, `${slot}.${index}`, sourceCommercialName, loveCommercialName),
    );
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as JsonRecord).map(([key, child]) => {
        const preserve = key === "courseId" || key === "id" || key === "index";
        return [
          key,
          preserve
            ? child
            : rewriteValue(child, route, `${slot}.${key}`, sourceCommercialName, loveCommercialName),
        ];
      }),
    );
  }
  return value;
}

function commercialNameFor(
  baseline: BaselineEntry,
  used: Set<string>,
  massageBomNames: Set<string>,
): string {
  const locality = baseline.approved.locality_label;
  for (let round = 0; round < MONIKER_PREFIXES.length * MONIKER_SUFFIXES.length; round += 1) {
    const prefix = MONIKER_PREFIXES[
      stableHash(`${baseline.route}\u0000moniker-prefix\u0000${round}`) %
        MONIKER_PREFIXES.length
    ];
    const suffix = MONIKER_SUFFIXES[
      stableHash(`${baseline.route}\u0000moniker-suffix\u0000${round}`) %
        MONIKER_SUFFIXES.length
    ];
    const candidate = `${locality} ${prefix} ${suffix}`;
    if (!used.has(candidate) && !massageBomNames.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
  }
  throw new Error(`MASSAGE_LOVE_MONIKER_SPACE_EXHAUSTED:${baseline.route}`);
}

function exactKeywords(nodePath: string, nodeLabel: string): string[] {
  const node = ACTIVE_REGION_NODES.find((candidate) => candidate.path === nodePath);
  if (!node) throw new Error(`MASSAGE_LOVE_NODE_MISSING:${nodePath}`);
  const label = getKeywordRegionLabel(node);
  if (label !== nodeLabel) {
    throw new Error(`MASSAGE_LOVE_KEYWORD_LABEL_MISMATCH:${nodePath}`);
  }
  return KEYWORD_SUFFIXES.map((suffix) => `${label}${suffix}`);
}

function manifestEntry(source: BaselineEntry, target: JsonRecord): JsonRecord {
  return {
    route: source.route,
    sourceSha256: sha256(
      JSON.stringify({
        approved: source.approved,
        seo: source.seo,
        editorial: source.editorial,
        customer: source.customer,
        exactShared: source.exactShared,
      }),
    ),
    targetSha256: sha256(JSON.stringify(target)),
    commercialName: target.commercialName,
  };
}

async function main() {
  const materialized = materializeMassageBom();
  const baseline = JSON.parse(materialized) as BaselinePayload;
  if (
    baseline.schemaVersion !== 1 ||
    baseline.source !== "massagebom-live-canonical-generators" ||
    baseline.routeCount !== 1291 ||
    baseline.entries.length !== 1291
  ) {
    throw new Error("MASSAGE_LOVE_BASELINE_PAYLOAD_INVALID");
  }

  const sourceByRoute = new Map(baseline.entries.map((entry) => [entry.route, entry]));
  if (sourceByRoute.size !== 1291) {
    throw new Error("MASSAGE_LOVE_BASELINE_ROUTE_DUPLICATE");
  }
  const lovePaths = new Set(ACTIVE_REGION_NODES.map((node) => node.path));
  const missing = [...lovePaths].filter((route) => !sourceByRoute.has(route));
  const extra = [...sourceByRoute.keys()].filter((route) => !lovePaths.has(route));
  if (missing.length || extra.length) {
    throw new Error(`MASSAGE_LOVE_ROUTE_JOIN_FAILED:missing=${missing.length}:extra=${extra.length}`);
  }

  const massageBomNames = new Set(
    baseline.entries.map((entry) => entry.approved.commercial_name),
  );
  const usedLoveNames = new Set<string>();
  const entries: JsonRecord[] = [];
  const manifestEntries: JsonRecord[] = [];

  for (const node of ACTIVE_REGION_NODES) {
    const source = sourceByRoute.get(node.path);
    if (!source) throw new Error(`MASSAGE_LOVE_SOURCE_MISSING:${node.path}`);
    if (
      source.node.recordIds.join("\u0000") !== node.records.map((record) => record.id).join("\u0000") ||
      (source.node.representative?.id ?? null) !== (node.representative?.id ?? null)
    ) {
      throw new Error(`MASSAGE_LOVE_NODE_SEMANTIC_JOIN_FAILED:${node.path}`);
    }

    const commercialName = commercialNameFor(source, usedLoveNames, massageBomNames);
    const sourceName = source.approved.commercial_name;
    const customer = asRecord(source.customer, `${node.path}:customer`);
    const editorial = asRecord(source.editorial, `${node.path}:editorial`);
    const directory = asRecord(customer.directory, `${node.path}:directory`);
    const introduction = asRecord(editorial.introduction, `${node.path}:introduction`);
    const trust = asRecord(editorial.trust, `${node.path}:trust`);
    const pricing = asRecord(customer.pricing, `${node.path}:pricing`);
    const courseChoice = asRecord(customer.courseChoice, `${node.path}:courseChoice`);
    const consultation = asRecord(customer.consultation, `${node.path}:consultation`);
    const standards = asRecord(customer.standards, `${node.path}:standards`);
    const process = asRecord(customer.process, `${node.path}:process`);
    const faq = asRecord(customer.faq, `${node.path}:faq`);
    if (!Array.isArray(faq.items) || faq.items.length !== 7) {
      throw new Error(`MASSAGE_LOVE_FAQ_COUNT_INVALID:${node.path}`);
    }

    const keywords = exactKeywords(node.path, getKeywordRegionLabel(node));
    const adaptedHeroLead = rewriteText(
      String(editorial.heroLead),
      node.path,
      "heroLead",
      sourceName,
      commercialName,
    );
    const adaptedIntro = rewriteValue(
      introduction,
      node.path,
      "introduction",
      sourceName,
      commercialName,
    ) as JsonRecord;
    const adaptedTrust = rewriteValue(
      trust,
      node.path,
      "trust",
      sourceName,
      commercialName,
    ) as JsonRecord;
    const adaptedDirectory = rewriteValue(
      directory,
      node.path,
      "directory",
      sourceName,
      commercialName,
    ) as JsonRecord;
    const adaptedPricing = rewriteValue(
      pricing,
      node.path,
      "pricing",
      sourceName,
      commercialName,
    ) as JsonRecord;
    const adaptedCourseChoice = rewriteValue(
      courseChoice,
      node.path,
      "courseChoice",
      sourceName,
      commercialName,
    ) as JsonRecord;
    const adaptedConsultation = rewriteValue(
      consultation,
      node.path,
      "consultation",
      sourceName,
      commercialName,
    ) as JsonRecord;
    const adaptedStandards = rewriteValue(
      standards,
      node.path,
      "standards",
      sourceName,
      commercialName,
    ) as JsonRecord;
    const adaptedProcess = rewriteValue(
      process,
      node.path,
      "process",
      sourceName,
      commercialName,
    ) as JsonRecord;

    const content = {
      platformId: "massage-love",
      route: node.path,
      pageType:
        node.kind === "root"
          ? "region-root"
          : node.kind === "hub"
            ? "region-hub"
            : "region-representative",
      regionId: node.id,
      regionName: node.displayName,
      regionAliases: node.aliases,
      keywordPrefixes: [getKeywordRegionLabel(node)],
      commercialName,
      localityLabel: source.approved.locality_label,
      fields: {
        title: rewriteText(
          source.seo.metadata.title,
          node.path,
          "title",
          sourceName,
          commercialName,
        ),
        description: rewriteText(
          source.seo.metadata.description,
          node.path,
          "description",
          sourceName,
          commercialName,
        ),
        keywords,
        h1: commercialName,
        eyebrow: `${source.approved.locality_label} · 24시간 전화상담`,
        ctaLabels: ["전화상담", "코스·가격 보기"],
      },
      heroLead: adaptedHeroLead,
      directory: adaptedDirectory,
      introduction: adaptedIntro,
      trust: adaptedTrust,
      pricing: adaptedPricing,
      courseChoice: adaptedCourseChoice,
      consultation: adaptedConsultation,
      standards: adaptedStandards,
      process: adaptedProcess,
      faq,
    } as const;
    const target = content as unknown as JsonRecord;
    entries.push(target);
    manifestEntries.push(manifestEntry(source, target));
  }

  const snapshot = {
    schemaVersion: "massage-love-region-content/v2",
    generatedBy: "scripts/sync-massagebom-region-baseline.ts",
    source: {
      type: baseline.source,
      routeCount: baseline.routeCount,
      sourceFiles: baseline.sourceFiles,
      routeDigest: sha256(baseline.entries.map((entry) => entry.route).join("\n")),
    },
    entries,
  };
  const manifest = {
    schemaVersion: "massage-love-massagebom-baseline-manifest/v1",
    status: "COMPLETE",
    routeCount: entries.length,
    strictPathJoin: { missing: 0, extra: 0 },
    source: snapshot.source,
    snapshotSha256: sha256(stableJson(snapshot)),
    entries: manifestEntries,
  };

  const snapshotBytes = stableJson(snapshot);
  for (const forbidden of [
    "[object Object]",
    "마사지봄",
    "이용 정보를 따라",
    "마사지러브 안내를 기준으로",
    "지역 안내에서",
  ]) {
    if (snapshotBytes.includes(forbidden)) {
      throw new Error(`MASSAGE_LOVE_SNAPSHOT_FORBIDDEN:${forbidden}`);
    }
  }

  await mkdir(path.dirname(snapshotPath), { recursive: true });
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(snapshotPath, snapshotBytes);
  await writeFile(manifestPath, stableJson(manifest));
  process.stdout.write(
    `${JSON.stringify({ routes: entries.length, snapshot: snapshotPath, manifest: manifestPath })}\n`,
  );
}

await main();
