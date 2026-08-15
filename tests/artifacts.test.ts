import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  validateNormativeReproducibilitySummary,
  validateSemanticReleaseLock,
} from "../scripts/normative-reproducibility-schema";
import { validateAiReviewReceipt } from "../scripts/ai-review-contract";
import { validateLocalChromiumReceipt } from "../scripts/local-browser-qa-contract";

const artifactRoot = path.resolve(process.cwd(), "artifacts");
const contentBytes = readFileSync(path.join(artifactRoot, "content-corpus.json"));
const content = JSON.parse(contentBytes.toString("utf8"));
const qualityReceiptBytes = readFileSync(
  path.join(artifactRoot, "content-quality-receipt.json"),
);
const campaign = JSON.parse(
  readFileSync(path.join(artifactRoot, "image-campaign-contract.json"), "utf8"),
);
const plan = JSON.parse(
  readFileSync(path.join(artifactRoot, "image-generation-plan.json"), "utf8"),
);
const builtVisibleBytes = readFileSync(
  path.join(artifactRoot, "built-visible-contract-receipt.v1.json"),
);
const builtVisible = JSON.parse(builtVisibleBytes.toString("utf8"));
const semanticReleaseLock = JSON.parse(
  readFileSync(
    path.join(artifactRoot, "built-visible-semantic-release-lock.v1.json"),
    "utf8",
  ),
);
const buildReproducibility = JSON.parse(
  readFileSync(
    path.join(artifactRoot, "build-semantic-reproducibility-receipt.v1.json"),
    "utf8",
  ),
);
const buildReproducibilityBytes = readFileSync(
  path.join(artifactRoot, "build-semantic-reproducibility-receipt.v1.json"),
);
const aiDecisionSourceBytes = readFileSync(
  path.join(artifactRoot, "content-ai-review-decisions.v1.json"),
);
const aiDecisionSource = JSON.parse(aiDecisionSourceBytes.toString("utf8"));
const aiReviewBytes = readFileSync(
  path.join(artifactRoot, "content-ai-review.v1.json"),
);
const aiReview = JSON.parse(aiReviewBytes.toString("utf8"));
const localChromiumBytes = readFileSync(
  path.join(artifactRoot, "local-chromium-qa.v1.json"),
);
const localChromium = JSON.parse(localChromiumBytes.toString("utf8"));
const fastCandidateBytes = readFileSync(
  path.join(artifactRoot, "fast-candidate.v1.json"),
);
const fastCandidate = JSON.parse(fastCandidateBytes.toString("utf8"));

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

describe("generated release artifacts", () => {
  it("exports a complete cross-platform corpus adapter", () => {
    expect(content.schemaVersion).toBe("cross-platform-content-corpus/v1");
    expect(content.platformId).toBe("massage-love");
    expect(content.status).toBe("COMPLETE");
    expect(content.counts.documents).toBe(1291);
    expect(content.entries).toHaveLength(1291);
    expect(content.counts.fixedDocuments).toBe(11);
    expect(content.counts.totalVisibleDocuments).toBe(1302);
    expect(content.fixedEntries).toHaveLength(11);
    expect(content.renderingContract.status).toBe("COMPLETE");
    expect(content.renderingContract.commonAndFixedVisibleCopyIncluded).toBe(true);
    expect(content.renderingContract.corpusDeclaredButNotSourceRenderedOccurrences).toBe(0);
    expect(content.renderingContract.sourceRenderedButNotCorpusDeclaredOccurrences).toBe(0);
    expect(content.routeVisibleContracts).toHaveLength(1301);
    expect(
      content.routeVisibleContracts.every(
        (entry: { route: string; contract: { schemaVersion: string; route: string } }) =>
          entry.contract.schemaVersion === "massage-love-visible-dom-contract/v2" &&
          entry.contract.route === entry.route,
      ),
    ).toBe(true);
    expect(content.counts.routeVisibleContracts).toBe(1301);
    expect(content.counts.declaredRegionalHeadings).toBe(9037);
    expect(content.counts.renderedRegionalHeadings).toBe(9037);
    expect(content.entries.every((entry: { regionName?: string }) => entry.regionName)).toBe(true);
    expect(
      content.entries.every(
        (entry: { keywordPrefixes?: string[]; fields: { keywords: string[] } }) =>
          entry.keywordPrefixes?.length === 1 &&
          entry.fields.keywords.every((keyword: string) =>
            keyword.startsWith(entry.keywordPrefixes![0]),
          ),
      ),
    ).toBe(true);
    expect(
      content.entries.every(
        (entry: {
          fields: { headings: string[] };
          rendered: { declaredHeadings: string[]; supplemental: { paragraphs: string[] } };
        }) =>
          JSON.stringify(entry.fields.headings) ===
            JSON.stringify(entry.rendered.declaredHeadings) &&
          entry.rendered.supplemental.paragraphs.length > 0,
      ),
    ).toBe(true);
    const fixedVisibleText = JSON.stringify(content.fixedEntries);
    expect(fixedVisibleText).toContain("오늘 저녁에 맞는 코스를 고르는 순서");
    expect(fixedVisibleText).toContain("전화 전에 네 줄만 메모해 두세요");
    expect(fixedVisibleText).not.toContain("준비 중");
    expect(fixedVisibleText).not.toContain("현재 주소");
    expect(JSON.stringify(content.routeVisibleContracts)).not.toContain("위치");
    const manifestPaths = content.sourceManifest.map((entry: { path: string }) => entry.path);
    for (const required of [
      "scripts/generate-artifacts.ts",
      "scripts/ai-review-contract.ts",
      "scripts/generate-ai-review.ts",
      "scripts/local-browser-qa-contract.ts",
      "scripts/generate-local-browser-qa.ts",
      "scripts/generate-fast-candidate.ts",
      "scripts/verify-built-visible-contract.ts",
      "src/lib/visible-dom-contract.ts",
      "src/lib/rendered-route-contract.tsx",
      "src/components/PriceLedger.tsx",
      "src/components/RootRegionGrid.tsx",
      "src/components/RegionPage.tsx",
      "src/app/areas/[...segments]/page.tsx",
      "src/app/layout.tsx",
    ]) {
      expect(manifestPaths).toContain(required);
    }
  });

  it("matches every built route to the declared visible DOM contract in both directions", () => {
    expect(builtVisible.schemaVersion).toBe(
      "massage-love-built-visible-semantic-contract-receipt/v4",
    );
    expect(builtVisible.status).toBe("PASS");
    expect(builtVisible.counts.routes).toBe(1301);
    expect(builtVisible.counts.passedRoutes).toBe(1301);
    expect(builtVisible.counts.failedRoutes).toBe(0);
    expect(builtVisible.counts.declaredButNotRenderedOccurrences).toBe(0);
    expect(builtVisible.counts.renderedButNotDeclaredOccurrences).toBe(0);
    expect(
      builtVisible.cases.every(
        (entry: {
          sourceMarkupSha256: string;
          declaredContractSha256: string;
          renderedContractSha256: string;
          status: string;
        }) =>
          /^[a-f0-9]{64}$/u.test(entry.sourceMarkupSha256) &&
          entry.declaredContractSha256 === entry.renderedContractSha256 &&
          entry.status === "PASS",
      ),
    ).toBe(true);
    expect(JSON.stringify(builtVisible)).not.toContain("htmlSha256");
    expect(JSON.stringify(builtVisible)).not.toContain("htmlPath");
    expect(JSON.stringify(builtVisible)).not.toMatch(
      /rawHtml|rawDiagnostic|rawObservation|built-visible-raw/u,
    );
    expect(builtVisible.seo.status).toBe("PASS");
    expect(builtVisible.seo.counts.routes).toBe(1301);
    expect(builtVisible.seo.counts.fixedRoutes).toBe(10);
    expect(builtVisible.seo.counts.regionalRoutes).toBe(1291);
    expect(builtVisible.seo.counts.failedRoutes).toBe(0);
    expect(builtVisible.seo.uniqueness.titles).toBe(1301);
    expect(builtVisible.seo.uniqueness.descriptions).toBe(1301);
    expect(builtVisible.seo.uniqueness.canonicals).toBe(1301);
    expect(builtVisible.seo.uniqueness.openGraphTitles).toBe(1301);
    expect(builtVisible.seo.uniqueness.openGraphDescriptions).toBe(1301);
    expect(builtVisible.seo.uniqueness.openGraphUrls).toBe(1301);
    expect(builtVisible.seo.uniqueness.twitterTitles).toBe(1301);
    expect(builtVisible.seo.uniqueness.twitterDescriptions).toBe(1301);
    expect(builtVisible.seo.uniqueness.regionalKeywords).toBe(1291);
    expect(builtVisible.seo.sitemap.actualUrls).toBe(1301);
    expect(builtVisible.seo.sitemap.missing).toEqual([]);
    expect(builtVisible.seo.sitemap.extra).toEqual([]);
    expect(
      builtVisible.seo.cases.every(
        (entry: {
          expected: { openGraph: unknown; twitter: unknown };
          actual: { openGraph: unknown; twitter: unknown };
          status: string;
        }) =>
          JSON.stringify(entry.actual.openGraph) === JSON.stringify(entry.expected.openGraph) &&
          JSON.stringify(entry.actual.twitter) === JSON.stringify(entry.expected.twitter) &&
          entry.status === "PASS",
      ),
    ).toBe(true);
  });

  it("keeps the prior six-build lock explicitly historical after the FAST source update", () => {
    const currentReceiptSha256 = sha256(builtVisibleBytes);
    const normativeSummarySha256 = sha256(buildReproducibilityBytes);
    validateNormativeReproducibilitySummary(buildReproducibility);
    validateSemanticReleaseLock(semanticReleaseLock, normativeSummarySha256);
    expect(semanticReleaseLock.status).toBe("LOCKED");
    expect(currentReceiptSha256).not.toBe(
      semanticReleaseLock.authority.semanticReceiptSha256,
    );
    expect(normativeSummarySha256).toBe(
      semanticReleaseLock.authority.normativeReproducibilitySummarySha256,
    );
    expect(buildReproducibility.status).toBe("PASS");
    expect(buildReproducibility.releaseAuthority).toBe(true);
    expect(buildReproducibility.normative.semanticReceiptSha256).toBe(
      semanticReleaseLock.authority.semanticReceiptSha256,
    );
    expect(buildReproducibility.normative.semanticCaseSetSha256).not.toBe(
      builtVisible.counts.semanticCaseSetSha256,
    );
    expect(buildReproducibility.topology.cleanBuildsPerRequiredSet).toBe(3);
    expect(buildReproducibility.topology.physicalPathGroupsPerRequiredSet).toBe(2);
    expect(buildReproducibility.topology.samePhysicalPathBuildsPerRequiredSet).toBe(2);
    expect(buildReproducibility.topology.differentPhysicalPathBuildsPerRequiredSet).toBe(1);
    expect(buildReproducibility.topology.independentRequiredSets).toBe(2);
    expect(buildReproducibility.variants.normativeSemanticReceiptVariants).toBe(1);
    expect(buildReproducibility.variants.semanticCaseSetVariants).toBe(1);
    expect(buildReproducibility.variants.corpusVariants).toBe(1);
    expect(buildReproducibility.variants.sourceManifestVariants).toBe(1);
    expect(buildReproducibility.variants.routeCountVariants).toBe(1);
    expect(JSON.stringify(buildReproducibility)).not.toMatch(
      /rawHtml|rawObservation|observedRaw|diagnosticVariants/u,
    );
    expect(JSON.stringify(semanticReleaseLock)).not.toMatch(/rawHtml|observation\.v1\.json/u);
  });

  it("fails closed on every normative field or topology tamper", () => {
    const normativeSummarySha256 = sha256(buildReproducibilityBytes);
    const tamperCases: Array<
      [string, (value: typeof buildReproducibility) => void]
    > = [
      ["semantic", (value) => { value.normative.semanticReceiptSha256 = "0".repeat(64); }],
      ["case-set", (value) => { value.normative.semanticCaseSetSha256 = "1".repeat(64); }],
      ["corpus", (value) => { value.normative.corpusSha256 = "2".repeat(64); }],
      ["source", (value) => { value.normative.sourceManifestSha256 = "3".repeat(64); }],
      ["topology", (value) => { value.topology.cleanBuildsPerRequiredSet = 4; }],
      ["variant", (value) => { value.variants.routeCountVariants = 2; }],
    ];
    for (const [, mutate] of tamperCases) {
      const tampered = structuredClone(buildReproducibility);
      mutate(tampered);
      expect(() => validateNormativeReproducibilitySummary(tampered)).toThrow();
    }

    const injectedSummary = structuredClone(buildReproducibility);
    injectedSummary.rawHtmlDiagnosticSha256 = "4".repeat(64);
    expect(() => validateNormativeReproducibilitySummary(injectedSummary)).toThrow();
    const injectedSummaryPath = structuredClone(buildReproducibility);
    injectedSummaryPath.rawObservationPath = "/tmp/non-authoritative.json";
    expect(() => validateNormativeReproducibilitySummary(injectedSummaryPath)).toThrow();
    const injectedSummaryCount = structuredClone(buildReproducibility);
    injectedSummaryCount.observedRawDiagnosticVariants = 99;
    expect(() => validateNormativeReproducibilitySummary(injectedSummaryCount)).toThrow();
    const injectedLock = structuredClone(semanticReleaseLock);
    injectedLock.rawObservationSha256 = "5".repeat(64);
    expect(() =>
      validateSemanticReleaseLock(injectedLock, normativeSummarySha256),
    ).toThrow();
    const injectedLockPath = structuredClone(semanticReleaseLock);
    injectedLockPath.rawObservationPath = "/tmp/non-authoritative.json";
    expect(() =>
      validateSemanticReleaseLock(injectedLockPath, normativeSummarySha256),
    ).toThrow();
  });

  it("binds 82 explicit AI decisions and 9 local Chromium cases without human or IAB claims", () => {
    const inputs = {
      corpus: content,
      corpusSha256: sha256(contentBytes),
      qualityReceiptSha256: sha256(qualityReceiptBytes),
      semanticReceipt: builtVisible,
      semanticReceiptSha256: sha256(builtVisibleBytes),
    };
    validateAiReviewReceipt(
      aiReview,
      aiDecisionSource,
      sha256(aiDecisionSourceBytes),
      inputs,
    );
    expect(aiReview.schemaVersion).toBe(
      "massage-love-independent-ai-content-review/v1",
    );
    expect(aiReview.status).toBe("PASS_AI_REVIEW");
    expect(aiReview.reviewType).toBe("INDEPENDENT_AI_CONTENT_REVIEW");
    expect(aiReview.humanReviewPerformed).toBe(false);
    expect(aiReview.humanApprovalClaimed).toBe(false);
    expect(aiReview.decisions).toEqual({
      required: 82,
      completed: 82,
      approved: 82,
      rejected: 0,
      empty: 0,
    });
    expect(aiReview.coverage.selectedFullTextFields).toBe(2087);
    expect(
      aiReview.candidates.every(
        (entry: { reason: string }) => Array.from(entry.reason.trim()).length >= 60,
      ),
    ).toBe(true);
    expect(new Set(aiReview.candidates.map((entry: { reason: string }) => entry.reason)).size)
      .toBe(82);

    validateLocalChromiumReceipt(localChromium, {
      corpusSha256: sha256(contentBytes),
      qualitySha256: sha256(qualityReceiptBytes),
      semanticSha256: sha256(builtVisibleBytes),
      semanticCaseSetSha256: builtVisible.counts.semanticCaseSetSha256,
    });
    expect(localChromium.status).toBe("PASS_LOCAL_FUNCTIONAL_QA");
    expect(localChromium.matrix.completedCases).toBe(9);
    expect(localChromium.claims.inAppBrowser).toBe(false);
    expect(localChromium.claims.humanReview).toBe(false);
    expect(localChromium.reproducibility.screenshotsOrImageFilesCreated).toBe(false);

    expect(fastCandidate.status).toBe("FAST_CANDIDATE");
    expect(fastCandidate.authority.publicGo).toBe(false);
    expect(fastCandidate.authority.humanApprovalClaimed).toBe(false);
    expect(fastCandidate.authority.inAppBrowserClaimed).toBe(false);
    expect(fastCandidate.browser.cases).toBe(9);
    expect(fastCandidate.finalIntegrationInput.corpusSha256).toBe(sha256(contentBytes));
    expect(fastCandidate.finalIntegrationInput.visibleActualSemanticReceiptSha256).toBe(
      sha256(builtVisibleBytes),
    );
    expect(fastCandidate.finalIntegrationInput.visibleActualCaseSetSha256).toBe(
      builtVisible.counts.semanticCaseSetSha256,
    );
    expect(fastCandidate.crossPlatform.pendingCandidates).toEqual([
      "rang-therapy",
      "mixed-love-massage",
    ]);
    expect(JSON.stringify(fastCandidate)).not.toMatch(/massagebom|massage-bom|star/u);
    expect(sha256(aiReviewBytes)).toBe(fastCandidate.bindings.aiContentReview.sha256);
    expect(sha256(localChromiumBytes)).toBe(fastCandidate.bindings.localChromiumQa.sha256);
    expect(sha256(fastCandidateBytes)).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("fails closed on empty AI decisions and false AI/IAB labels", () => {
    const inputs = {
      corpus: content,
      corpusSha256: sha256(contentBytes),
      qualityReceiptSha256: sha256(qualityReceiptBytes),
      semanticReceipt: builtVisible,
      semanticReceiptSha256: sha256(builtVisibleBytes),
    };
    const sourceTamperCases: Array<(value: typeof aiDecisionSource) => void> = [
      (value) => { value.decisions = []; },
      (value) => { value.reviewer.kind = "HUMAN"; },
    ];
    for (const mutate of sourceTamperCases) {
      const tampered = structuredClone(aiDecisionSource);
      mutate(tampered);
      expect(() =>
        validateAiReviewReceipt(
          aiReview,
          tampered,
          sha256(aiDecisionSourceBytes),
          inputs,
        ),
      ).toThrow();
    }

    const tamperedBrowser = structuredClone(localChromium);
    tamperedBrowser.claims.inAppBrowser = true;
    expect(() =>
      validateLocalChromiumReceipt(tamperedBrowser, {
        corpusSha256: sha256(contentBytes),
        qualitySha256: sha256(qualityReceiptBytes),
        semanticSha256: sha256(builtVisibleBytes),
        semanticCaseSetSha256: builtVisible.counts.semanticCaseSetSha256,
      }),
    ).toThrow();
  }, 15_000);

  it("assigns 323 planned images over 1,291 routes as 322x4 plus 1x3", () => {
    expect(campaign.status).toBe("PLANNED_NO_ASSETS");
    expect(campaign.counts.routes).toBe(1291);
    expect(campaign.regionalImages).toHaveLength(323);
    expect(campaign.assignments).toHaveLength(1291);
    expect(campaign.counts.regionalReuseDistribution).toEqual({ "3": 1, "4": 322 });
  });

  it("keeps the home hero exclusive and outside regional assignments", () => {
    expect(campaign.homeHero.imageId).toBe("MLV-HOME-001");
    expect(campaign.homeHero.exclusiveToRoute).toBe("/");
    expect(campaign.homeHero.allowRegionalReuse).toBe(false);
    expect(
      campaign.assignments.some(
        (assignment: { imageId: string }) => assignment.imageId === "MLV-HOME-001",
      ),
    ).toBe(false);
  });

  it("has 324 text-only jobs in exact five-lane waves", () => {
    expect(plan.status).toBe("READY_FOR_COORDINATED_RUN");
    expect(plan.runtimeLanes).toBe(5);
    expect(plan.counts.jobs).toBe(324);
    expect(plan.counts.regional).toBe(323);
    expect(plan.counts.home).toBe(1);
    expect(plan.counts.waves).toBe(65);
    expect(plan.counts.fullFiveLaneWaves).toBe(64);
    expect(plan.counts.finalWaveSize).toBe(4);
    expect(new Set(plan.jobs.map((job: { promptSha256: string }) => job.promptSha256)).size).toBe(324);
    expect(plan.jobs.every((job: { referenceImages: unknown[] }) => job.referenceImages.length === 0)).toBe(true);
  });

  it("keeps every asset binding fail-closed until real bytes exist", () => {
    for (const image of campaign.regionalImages) {
      expect(image.source.sha256).toBeNull();
      expect(image.refinement.receiptSha256).toBeNull();
      expect(image.publicAsset.sha256).toBeNull();
      expect(image.perceptualHash).toBeNull();
      expect(image.palette.status).toBe("PENDING_REFINED_ASSET_ANALYSIS");
      expect(image.headerBinding.status).toBe("PENDING_PALETTE");
    }
  });
});
