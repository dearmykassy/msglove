import { createHash } from "node:crypto";

type JsonRecord = Record<string, unknown>;

type CorpusDocument = {
  route: string;
  pageType: string;
  fields: JsonRecord;
};

type RouteVisibleContract = {
  route: string;
  sourceMarkupSha256: string;
  contract?: { digestSha256: string };
  contractSha256?: string;
};

function visibleContractSha256(contract: RouteVisibleContract | undefined): string | null {
  return contract?.contractSha256 ?? contract?.contract?.digestSha256 ?? null;
}

export type HumanReviewInputs = {
  corpus: JsonRecord;
  corpusSha256: string;
  qualityReceiptSha256: string;
  semanticReceipt: JsonRecord;
  semanticReceiptSha256: string;
};

const TARGETED_REVIEW_ROUTES = [
  {
    route: "/areas/seoul/%EB%85%B8%EC%9B%90%EA%B5%AC",
    reasons: ["service-completion-before-payment", "course-duration schedule advice"],
  },
  {
    route: "/areas/seoul/%EC%84%9C%EB%8C%80%EB%AC%B8%EA%B5%AC",
    reasons: ["confirmed on-site card payment", "natural consultation heading"],
  },
  {
    route: "/areas/seoul/%EA%B0%95%EC%84%9C%EA%B5%AC/%EB%93%B1%EC%B4%8C%EB%8F%99",
    reasons: [
      "representative-page scope",
      "natural consultation heading",
      "course-duration schedule advice",
    ],
  },
  {
    route: "/areas/gumi/%EC%9E%84%EC%98%A4%EB%8F%99",
    reasons: ["unsupported safety wording removed", "on-site payment heading"],
  },
  {
    route: "/areas/asan/%EC%98%A8%EC%96%91%EB%8F%99",
    reasons: [
      "auxiliary-verb spacing",
      "service address wording",
      "representative-page scope",
    ],
  },
  {
    route: "/areas/jeju/%EC%A0%9C%EC%A3%BC%EC%8B%9C/%EC%B6%94%EC%9E%90%EB%A9%B4",
    reasons: ["service address wording", "representative-page scope"],
  },
  {
    route: "/areas/jeju/%EC%A0%9C%EC%A3%BC%EC%8B%9C/%ED%99%94%EB%B6%81%EB%8F%99",
    reasons: ["kind-aware leaf heading", "service-address schedule advice"],
  },
  ...[
    "/areas/seoul/%EA%B4%91%EC%A7%84%EA%B5%AC/%EA%B5%B0%EC%9E%90%EB%8F%99",
    "/areas/seoul/%EC%84%B1%EB%B6%81%EA%B5%AC/%EC%82%BC%EC%84%A0%EB%8F%99",
    "/areas/seoul/%EC%A4%91%EB%9E%91%EA%B5%AC/%EB%A9%B4%EB%AA%A9%EB%8F%99",
    "/areas/incheon/%EC%98%B9%EC%A7%84%EA%B5%B0/%EC%97%B0%ED%8F%89%EB%A9%B4",
    "/areas/gyeonggi/%EA%B5%AC%EB%A6%AC%EC%8B%9C/%EA%B5%90%EB%AC%B8%EB%8F%99",
    "/areas/gyeonggi/%EB%B6%80%EC%B2%9C%EC%8B%9C/%EC%9B%90%EB%AF%B8%EA%B5%AC/%EC%A4%91%EB%8F%99",
    "/areas/gyeonggi/%EC%95%88%EC%96%91%EC%8B%9C/%EB%8F%99%EC%95%88%EA%B5%AC/%EB%8B%AC%EC%95%88%EB%8F%99",
    "/areas/cheonan/%EB%8F%99%EB%82%A8%EA%B5%AC/%ED%92%8D%EC%84%B8%EB%A9%B4",
    "/areas/daejeon/%EC%A4%91%EA%B5%AC/%EB%AC%B8%ED%99%94%EB%8F%99",
    "/areas/daegu/%EC%84%9C%EA%B5%AC/%EB%B9%84%EC%82%B0%EB%8F%99",
    "/areas/busan/%EB%B6%81%EA%B5%AC",
  ].map((route) => ({
    route,
    reasons: ["adjacent availability meaning separation", "changed-plan caller action"],
  })),
  {
    route: "/areas/seoul/%EA%B0%95%EB%8F%99%EA%B5%AC/%EA%B0%95%EC%9D%BC%EB%8F%99",
    reasons: [
      "address criterion followed by a distinct caller action",
      "general adjacent semantic tuple gate",
    ],
  },
] as const;

const MINIMUM_COVERAGE = {
  topLevelRoutes: 11,
  sampleRoutes: 31,
  targetedRoutes: 19,
  longestFields: 24,
  fixedAndCommonRoutes: 8,
} as const;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function stableCompact(value: unknown): string {
  const normalize = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(normalize);
    if (input && typeof input === "object") {
      return Object.fromEntries(
        Object.entries(input as JsonRecord)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, child]) => [key, normalize(child)]),
      );
    }
    return input;
  };
  return JSON.stringify(normalize(value));
}

function documents(corpus: JsonRecord): {
  regions: CorpusDocument[];
  fixed: CorpusDocument[];
} {
  if (!Array.isArray(corpus.entries) || !Array.isArray(corpus.fixedEntries)) {
    throw new Error("MASSAGE_LOVE_HUMAN_TEMPLATE_CORPUS_DOCUMENTS_MISSING");
  }
  return {
    regions: corpus.entries as CorpusDocument[],
    fixed: corpus.fixedEntries as CorpusDocument[],
  };
}

function flattenFields(value: unknown, prefix = ""): Array<{ field: string; fullText: string }> {
  if (typeof value === "string") {
    return value.trim() ? [{ field: prefix, fullText: value }] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((child, index) => flattenFields(child, `${prefix}[${index}]`));
  }
  if (value && typeof value === "object") {
    return Object.entries(value as JsonRecord).flatMap(([key, child]) =>
      flattenFields(child, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [];
}

function selectSampleRoutes(regions: CorpusDocument[]): string[] {
  const roots = regions.filter((entry) => entry.pageType === "region-root");
  const routes: string[] = [];
  for (const root of roots) {
    routes.push(root.route);
    const prefix = `${root.route}/`;
    const hub = regions.find(
      (entry) => entry.pageType === "region-hub" && entry.route.startsWith(prefix),
    );
    if (hub) {
      routes.push(hub.route);
      const representative = regions.find(
        (entry) =>
          entry.pageType === "region-representative" &&
          entry.route.startsWith(`${hub.route}/`),
      );
      if (!representative) {
        throw new Error(`MASSAGE_LOVE_HUMAN_TEMPLATE_SAMPLE_LEAF_MISSING:${hub.route}`);
      }
      routes.push(representative.route);
    } else {
      const representative = regions.find(
        (entry) =>
          entry.pageType === "region-representative" && entry.route.startsWith(prefix),
      );
      if (!representative) {
        throw new Error(`MASSAGE_LOVE_HUMAN_TEMPLATE_SAMPLE_LEAF_MISSING:${root.route}`);
      }
      routes.push(representative.route);
    }
  }
  return routes;
}

function assertCoverage(coverage: Record<string, number>): void {
  for (const [field, minimum] of Object.entries(MINIMUM_COVERAGE)) {
    if ((coverage[field] ?? 0) < minimum) {
      throw new Error(
        `MASSAGE_LOVE_HUMAN_TEMPLATE_MINIMUM_COVERAGE:${field}:${coverage[field] ?? 0}:${minimum}`,
      );
    }
  }
}

export function buildHumanReviewTemplate(inputs: HumanReviewInputs) {
  const { regions, fixed } = documents(inputs.corpus);
  if (
    inputs.corpus.status !== "COMPLETE" ||
    regions.length !== 1291 ||
    fixed.length !== 11 ||
    inputs.semanticReceipt.status !== "PASS" ||
    inputs.semanticReceipt.schemaVersion !==
      "massage-love-built-visible-semantic-contract-receipt/v4" ||
    (inputs.semanticReceipt.corpus as JsonRecord | undefined)?.sha256 !==
      inputs.corpusSha256
  ) {
    throw new Error("MASSAGE_LOVE_HUMAN_TEMPLATE_SOURCE_BINDING_INVALID");
  }
  const routeContracts = new Map(
    ((inputs.corpus.routeVisibleContracts as RouteVisibleContract[] | undefined) ?? []).map(
      (entry) => [entry.route, entry],
    ),
  );
  const regionByRoute = new Map(regions.map((entry) => [entry.route, entry]));
  const topLevelRoutes = regions
    .filter((entry) => entry.pageType === "region-root")
    .map((entry) => entry.route);
  const sampleRoutes = selectSampleRoutes(regions);
  const targetedRoutes = TARGETED_REVIEW_ROUTES.map((entry) => ({
    route: entry.route,
    reasons: [...entry.reasons],
  }));
  for (const entry of targetedRoutes) {
    if (!regionByRoute.has(entry.route)) {
      throw new Error(`MASSAGE_LOVE_HUMAN_TEMPLATE_TARGET_ROUTE_MISSING:${entry.route}`);
    }
  }
  const allFieldCandidates = [...regions, ...fixed]
    .flatMap((document) =>
      flattenFields(document.fields).map((field) => ({
        route: document.route,
        field: field.field,
        fullText: field.fullText,
        characters: Array.from(field.fullText).length,
        fullTextSha256: sha256(field.fullText),
      })),
    )
    .sort(
      (left, right) =>
        right.characters - left.characters ||
        left.route.localeCompare(right.route) ||
        left.field.localeCompare(right.field),
    );
  const longestFields = allFieldCandidates.slice(0, MINIMUM_COVERAGE.longestFields);
  const fixedAndCommonRoutes = fixed.map((entry) => entry.route);
  const selectedRouteSet = new Set([
    ...sampleRoutes,
    ...topLevelRoutes,
    ...targetedRoutes.map((entry) => entry.route),
    ...longestFields.map((entry) => entry.route),
    ...fixedAndCommonRoutes,
  ]);
  const allDocuments = new Map(
    [...regions, ...fixed].map((entry) => [entry.route, entry]),
  );
  const reviewRoutes = [...selectedRouteSet]
    .sort((left, right) => left.localeCompare(right))
    .map((route) => {
      const document = allDocuments.get(route);
      if (!document) throw new Error(`MASSAGE_LOVE_HUMAN_TEMPLATE_ROUTE_MISSING:${route}`);
      const routeContract = routeContracts.get(route);
      if (route !== "__site-common__" && !routeContract) {
        throw new Error(`MASSAGE_LOVE_HUMAN_TEMPLATE_ROUTE_SOURCE_MISSING:${route}`);
      }
      const sourceFieldsSha256 = sha256(stableCompact(document.fields));
      const fields = flattenFields(document.fields).map(({ field, fullText }) => {
        const fullTextSha256 = sha256(fullText);
        return {
          field,
          fullText,
          fullTextSha256,
          bindingSha256: sha256(
            [
              route,
              field,
              fullText,
              sourceFieldsSha256,
              inputs.corpusSha256,
              inputs.semanticReceiptSha256,
            ].join("\u0000"),
          ),
          decision: "",
          reviewerNote: "",
        };
      });
      return {
        route,
        pageType: document.pageType,
        source: {
          fieldsSha256: sourceFieldsSha256,
          markupSha256: routeContract?.sourceMarkupSha256 ?? null,
          visibleContractSha256: visibleContractSha256(routeContract),
        },
        fieldCount: fields.length,
        fields,
        routeFieldsSha256: sha256(
          fields
            .map((field) => `${route}\u0000${field.field}\u0000${field.fullTextSha256}`)
            .join("\n"),
        ),
        decision: "",
        reviewerNote: "",
      };
    });
  const selectionHashes = {
    sampleSha256: sha256(stableCompact(sampleRoutes)),
    targetedSha256: sha256(stableCompact(targetedRoutes)),
    topLevelSha256: sha256(stableCompact(topLevelRoutes)),
    longestSha256: sha256(stableCompact(longestFields)),
    fixedAndCommonSha256: sha256(stableCompact(fixedAndCommonRoutes)),
    reviewRoutesSha256: sha256(stableCompact(reviewRoutes)),
  };
  const coverage = {
    topLevelRoutes: topLevelRoutes.length,
    sampleRoutes: sampleRoutes.length,
    targetedRoutes: targetedRoutes.length,
    longestFields: longestFields.length,
    fixedAndCommonRoutes: fixedAndCommonRoutes.length,
    selectedUniqueRoutes: reviewRoutes.length,
    selectedFullTextFields: reviewRoutes.reduce(
      (count, entry) => count + entry.fieldCount,
      0,
    ),
  };
  assertCoverage(coverage);
  const templateWithoutIntegrity = {
    schemaVersion: "massage-love-content-human-review/v6",
    status: "PENDING_HUMAN_REVIEW",
    releaseAuthority: false,
    policy: {
      generatorMayApprove: false,
      everyDecisionStartsBlank: true,
      fullTextRequired: true,
      routeFieldSourceCorpusSemanticBindingRequired: true,
      emptySampleOrTargetedSelectionAllowed: false,
      minimumCoverage: MINIMUM_COVERAGE,
    },
    bindings: {
      corpus: {
        path: "artifacts/content-corpus.json",
        sha256: inputs.corpusSha256,
        sourceManifestSha256: inputs.corpus.sourceManifestSha256,
      },
      quality: {
        path: "artifacts/content-quality-receipt.json",
        sha256: inputs.qualityReceiptSha256,
      },
      semantic: {
        path: "artifacts/built-visible-contract-receipt.v1.json",
        sha256: inputs.semanticReceiptSha256,
        semanticCaseSetSha256: (inputs.semanticReceipt.counts as JsonRecord)
          .semanticCaseSetSha256,
      },
    },
    coverage,
    selections: {
      sampleRoutes,
      targetedRoutes,
      topLevelRoutes,
      longestFields,
      fixedAndCommonRoutes,
    },
    selectionHashes,
    reviewRoutes,
    decisions: {
      reviewerName: "",
      reviewedAt: "",
      overallDecision: "",
      reviewerNote: "",
    },
  };
  return {
    ...templateWithoutIntegrity,
    templateIntegritySha256: sha256(stableCompact(templateWithoutIntegrity)),
  };
}

export function validatePendingHumanReviewTemplate(
  value: unknown,
  inputs: HumanReviewInputs,
): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("MASSAGE_LOVE_HUMAN_TEMPLATE_NOT_OBJECT");
  }
  const template = value as JsonRecord;
  const selections = template.selections as JsonRecord | undefined;
  if (
    !Array.isArray(selections?.sampleRoutes) ||
    selections.sampleRoutes.length === 0 ||
    !Array.isArray(selections.targetedRoutes) ||
    selections.targetedRoutes.length === 0
  ) {
    throw new Error("MASSAGE_LOVE_HUMAN_TEMPLATE_EMPTY_REQUIRED_SELECTION");
  }
  const reviewRoutes = template.reviewRoutes as Array<{
    decision?: unknown;
    reviewerNote?: unknown;
    fields?: Array<{ decision?: unknown; reviewerNote?: unknown }>;
  }>;
  const rootDecisions = template.decisions as JsonRecord | undefined;
  if (
    !Array.isArray(reviewRoutes) ||
    reviewRoutes.some(
      (route) =>
        route.decision !== "" ||
        route.reviewerNote !== "" ||
        !Array.isArray(route.fields) ||
        route.fields.some(
          (field) => field.decision !== "" || field.reviewerNote !== "",
        ),
    ) ||
    !rootDecisions ||
    Object.values(rootDecisions).some((decision) => decision !== "")
  ) {
    throw new Error("MASSAGE_LOVE_HUMAN_TEMPLATE_DECISIONS_MUST_START_BLANK");
  }
  const expected = buildHumanReviewTemplate(inputs);
  if (stableCompact(value) !== stableCompact(expected)) {
    throw new Error("MASSAGE_LOVE_HUMAN_TEMPLATE_TAMPER_OR_DRIFT");
  }
}
