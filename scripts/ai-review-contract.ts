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

export type AiReviewInputs = {
  corpus: JsonRecord;
  corpusSha256: string;
  qualityReceiptSha256: string;
  semanticReceipt: JsonRecord;
  semanticReceiptSha256: string;
};

type DecisionRecord = {
  candidateId: string;
  candidateSha256: string;
  verdict: "APPROVE";
  reason: string;
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

export function canonicalJson(value: unknown): string {
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

function assertExactKeys(value: JsonRecord, keys: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    throw new Error(`MASSAGE_LOVE_AI_REVIEW_${label}_KEYS_INVALID`);
  }
}

function documents(corpus: JsonRecord): { regions: CorpusDocument[]; fixed: CorpusDocument[] } {
  if (!Array.isArray(corpus.entries) || !Array.isArray(corpus.fixedEntries)) {
    throw new Error("MASSAGE_LOVE_AI_REVIEW_CORPUS_DOCUMENTS_MISSING");
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
        throw new Error(`MASSAGE_LOVE_AI_REVIEW_SAMPLE_LEAF_MISSING:${hub.route}`);
      }
      routes.push(representative.route);
    } else {
      const representative = regions.find(
        (entry) =>
          entry.pageType === "region-representative" && entry.route.startsWith(prefix),
      );
      if (!representative) {
        throw new Error(`MASSAGE_LOVE_AI_REVIEW_SAMPLE_LEAF_MISSING:${root.route}`);
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
        `MASSAGE_LOVE_AI_REVIEW_MINIMUM_COVERAGE:${field}:${coverage[field] ?? 0}:${minimum}`,
      );
    }
  }
}

export function buildAiReviewSelection(inputs: AiReviewInputs) {
  const { regions, fixed } = documents(inputs.corpus);
  const semanticCounts = inputs.semanticReceipt.counts as JsonRecord | undefined;
  if (
    inputs.corpus.status !== "COMPLETE" ||
    regions.length !== 1291 ||
    fixed.length !== 11 ||
    inputs.semanticReceipt.status !== "PASS" ||
    inputs.semanticReceipt.schemaVersion !==
      "massage-love-built-visible-semantic-contract-receipt/v4" ||
    (inputs.semanticReceipt.corpus as JsonRecord | undefined)?.sha256 !==
      inputs.corpusSha256 ||
    semanticCounts?.routes !== 1301 ||
    semanticCounts?.failedRoutes !== 0
  ) {
    throw new Error("MASSAGE_LOVE_AI_REVIEW_SOURCE_BINDING_INVALID");
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
      throw new Error(`MASSAGE_LOVE_AI_REVIEW_TARGET_ROUTE_MISSING:${entry.route}`);
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
  const allDocuments = new Map([...regions, ...fixed].map((entry) => [entry.route, entry]));
  const sampleSet = new Set(sampleRoutes);
  const topLevelSet = new Set(topLevelRoutes);
  const targetedByRoute = new Map(targetedRoutes.map((entry) => [entry.route, entry.reasons]));
  const longestSet = new Set(longestFields.map((entry) => entry.route));
  const fixedSet = new Set(fixedAndCommonRoutes);
  const semanticCaseSetSha256 = String(semanticCounts.semanticCaseSetSha256 ?? "");

  const candidates = [...selectedRouteSet]
    .sort((left, right) => left.localeCompare(right))
    .map((route, index) => {
      const document = allDocuments.get(route);
      if (!document) throw new Error(`MASSAGE_LOVE_AI_REVIEW_ROUTE_MISSING:${route}`);
      const routeContract = routeContracts.get(route);
      if (route !== "__site-common__" && !routeContract) {
        throw new Error(`MASSAGE_LOVE_AI_REVIEW_ROUTE_SOURCE_MISSING:${route}`);
      }
      const candidateId = `MLV-AI-${String(index + 1).padStart(3, "0")}`;
      const sourceFieldsSha256 = sha256(canonicalJson(document.fields));
      const fields = flattenFields(document.fields).map(({ field, fullText }) => ({
        field,
        fullText,
        fullTextSha256: sha256(fullText),
        bindingSha256: sha256(
          [
            candidateId,
            route,
            field,
            fullText,
            sourceFieldsSha256,
            inputs.corpusSha256,
            inputs.qualityReceiptSha256,
            inputs.semanticReceiptSha256,
          ].join("\u0000"),
        ),
      }));
      const routeFieldsSha256 = sha256(
        fields
          .map((field) => `${route}\u0000${field.field}\u0000${field.fullTextSha256}`)
          .join("\n"),
      );
      const selectionGroups = [
        ...(sampleSet.has(route) ? ["sample-route"] : []),
        ...(topLevelSet.has(route) ? ["top-level-route"] : []),
        ...(targetedByRoute.has(route) ? ["targeted-regression"] : []),
        ...(longestSet.has(route) ? ["longest-field"] : []),
        ...(fixedSet.has(route) ? ["fixed-or-common"] : []),
      ];
      const source = {
        fieldsSha256: sourceFieldsSha256,
        markupSha256: routeContract?.sourceMarkupSha256 ?? null,
        visibleContractSha256: visibleContractSha256(routeContract),
      };
      const candidateSha256 = sha256(
        canonicalJson({
          candidateId,
          route,
          pageType: document.pageType,
          selectionGroups,
          targetedReasons: targetedByRoute.get(route) ?? [],
          source,
          fieldCount: fields.length,
          routeFieldsSha256,
          corpusSha256: inputs.corpusSha256,
          qualityReceiptSha256: inputs.qualityReceiptSha256,
          semanticReceiptSha256: inputs.semanticReceiptSha256,
          semanticCaseSetSha256,
        }),
      );
      return {
        candidateId,
        candidateSha256,
        route,
        pageType: document.pageType,
        selectionGroups,
        targetedReasons: targetedByRoute.get(route) ?? [],
        source,
        fieldCount: fields.length,
        routeFieldsSha256,
        fields,
      };
    });

  const selectionHashes = {
    sampleSha256: sha256(canonicalJson(sampleRoutes)),
    targetedSha256: sha256(canonicalJson(targetedRoutes)),
    topLevelSha256: sha256(canonicalJson(topLevelRoutes)),
    longestSha256: sha256(canonicalJson(longestFields)),
    fixedAndCommonSha256: sha256(canonicalJson(fixedAndCommonRoutes)),
    candidatesSha256: sha256(
      canonicalJson(candidates.map(({ fields: _fields, ...candidate }) => candidate)),
    ),
  };
  const coverage = {
    topLevelRoutes: topLevelRoutes.length,
    sampleRoutes: sampleRoutes.length,
    targetedRoutes: targetedRoutes.length,
    longestFields: longestFields.length,
    fixedAndCommonRoutes: fixedAndCommonRoutes.length,
    selectedUniqueRoutes: candidates.length,
    selectedFullTextFields: candidates.reduce(
      (count, entry) => count + entry.fieldCount,
      0,
    ),
  };
  assertCoverage(coverage);
  if (coverage.selectedUniqueRoutes !== 82 || coverage.selectedFullTextFields !== 2087) {
    throw new Error(
      `MASSAGE_LOVE_AI_REVIEW_SELECTION_DRIFT:${coverage.selectedUniqueRoutes}:${coverage.selectedFullTextFields}`,
    );
  }
  return {
    coverage,
    selections: {
      sampleRoutes,
      targetedRoutes,
      topLevelRoutes,
      longestFields,
      fixedAndCommonRoutes,
    },
    selectionHashes,
    candidates,
  };
}

function validateDecisionSource(value: unknown, expectedCandidates: ReturnType<typeof buildAiReviewSelection>["candidates"]): DecisionRecord[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("MASSAGE_LOVE_AI_REVIEW_DECISION_SOURCE_NOT_OBJECT");
  }
  const source = value as JsonRecord;
  assertExactKeys(
    source,
    [
      "schemaVersion",
      "reviewType",
      "reviewer",
      "reviewedOn",
      "authorityScope",
      "humanApprovalClaimed",
      "publicGoAuthority",
      "decisions",
    ],
    "DECISION_SOURCE",
  );
  if (
    source.schemaVersion !== "massage-love-independent-ai-content-review-decisions/v1" ||
    source.reviewType !== "INDEPENDENT_AI_CONTENT_REVIEW" ||
    source.reviewedOn !== "2026-08-15" ||
    source.authorityScope !== "project-local-fast-candidate-evidence-only" ||
    source.humanApprovalClaimed !== false ||
    source.publicGoAuthority !== false
  ) {
    throw new Error("MASSAGE_LOVE_AI_REVIEW_DECISION_SOURCE_LABEL_INVALID");
  }
  const reviewer = source.reviewer;
  if (!reviewer || typeof reviewer !== "object" || Array.isArray(reviewer)) {
    throw new Error("MASSAGE_LOVE_AI_REVIEW_REVIEWER_INVALID");
  }
  assertExactKeys(reviewer as JsonRecord, ["kind", "id", "human"], "REVIEWER");
  if (
    (reviewer as JsonRecord).kind !== "AI" ||
    (reviewer as JsonRecord).human !== false ||
    (reviewer as JsonRecord).id !==
      "openai-codex-independent-content-review-2026-08-15"
  ) {
    throw new Error("MASSAGE_LOVE_AI_REVIEW_REVIEWER_LABEL_INVALID");
  }
  if (!Array.isArray(source.decisions) || source.decisions.length !== expectedCandidates.length) {
    throw new Error("MASSAGE_LOVE_AI_REVIEW_DECISION_COUNT_INVALID");
  }
  const decisions = source.decisions as JsonRecord[];
  const ids = new Set<string>();
  const hashes = new Set<string>();
  const reasons = new Set<string>();
  for (const [index, decision] of decisions.entries()) {
    assertExactKeys(
      decision,
      ["candidateId", "candidateSha256", "verdict", "reason"],
      `DECISION_${index}`,
    );
    const expected = expectedCandidates[index];
    if (
      decision.candidateId !== expected.candidateId ||
      decision.candidateSha256 !== expected.candidateSha256 ||
      decision.verdict !== "APPROVE" ||
      typeof decision.reason !== "string" ||
      decision.reason !== decision.reason.trim() ||
      Array.from(decision.reason).length < 60
    ) {
      throw new Error(`MASSAGE_LOVE_AI_REVIEW_DECISION_INVALID:${expected.candidateId}`);
    }
    ids.add(String(decision.candidateId));
    hashes.add(String(decision.candidateSha256));
    reasons.add(decision.reason);
  }
  if (
    ids.size !== expectedCandidates.length ||
    hashes.size !== expectedCandidates.length ||
    reasons.size !== expectedCandidates.length
  ) {
    throw new Error("MASSAGE_LOVE_AI_REVIEW_DECISION_NOT_ITEM_BOUND_UNIQUE");
  }
  return decisions as DecisionRecord[];
}

export function buildAiReviewReceipt(
  decisionSource: unknown,
  decisionSourceSha256: string,
  inputs: AiReviewInputs,
) {
  const selection = buildAiReviewSelection(inputs);
  const decisions = validateDecisionSource(decisionSource, selection.candidates);
  return {
    schemaVersion: "massage-love-independent-ai-content-review/v1",
    status: "PASS_AI_REVIEW",
    releaseImpact: "FAST_CANDIDATE_EVIDENCE_ONLY",
    authority: {
      scope: "project-local-fast-candidate-evidence-only",
      publicGo: false,
      globalGo: false,
      deploymentAuthorized: false,
    },
    reviewType: "INDEPENDENT_AI_CONTENT_REVIEW",
    reviewer: (decisionSource as JsonRecord).reviewer,
    humanReviewPerformed: false,
    humanApprovalClaimed: false,
    automaticBlanketApprovalAllowed: false,
    publicGoAuthority: false,
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
      decisionSource: {
        path: "artifacts/content-ai-review-decisions.v1.json",
        sha256: decisionSourceSha256,
      },
    },
    coverage: selection.coverage,
    selections: selection.selections,
    selectionHashes: selection.selectionHashes,
    decisions: {
      required: selection.candidates.length,
      completed: decisions.length,
      approved: decisions.filter((entry) => entry.verdict === "APPROVE").length,
      rejected: 0,
      empty: 0,
    },
    candidates: selection.candidates.map((candidate, index) => ({
      ...candidate,
      verdict: decisions[index].verdict,
      reason: decisions[index].reason,
      decisionSha256: sha256(
        canonicalJson({
          candidateId: candidate.candidateId,
          candidateSha256: candidate.candidateSha256,
          verdict: decisions[index].verdict,
          reason: decisions[index].reason,
        }),
      ),
    })),
  };
}

export function validateAiReviewReceipt(
  value: unknown,
  decisionSource: unknown,
  decisionSourceSha256: string,
  inputs: AiReviewInputs,
): void {
  const expected = buildAiReviewReceipt(decisionSource, decisionSourceSha256, inputs);
  if (canonicalJson(value) !== canonicalJson(expected)) {
    throw new Error("MASSAGE_LOVE_AI_REVIEW_RECEIPT_TAMPER_OR_DRIFT");
  }
}
