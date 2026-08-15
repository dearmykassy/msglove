import { createHash } from "node:crypto";
import { access, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BUSINESS, COURSE_PRICING, PRICE_ITEM_COUNT } from "../src/data/business";
import { buildSourceRouteMarkups } from "../src/lib/rendered-route-contract";
import { SITE_ORIGIN } from "../src/lib/site-config";
import { normalizeVisibleDomValue } from "../src/lib/visible-dom-contract";
import { validateAiReviewReceipt } from "./ai-review-contract";
import { validateLocalChromiumReceipt } from "./local-browser-qa-contract";

type JsonRecord = Record<string, unknown>;

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HOME_HERO_PUBLIC_PATH = "public/images/massage-love-home/v1/home-hero-openai-v1.png";
const HOME_HERO_SHA256 = "67e2041de462dcc08381f6b7cba41ab50ab836730891e8b814ce206197533579";

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

async function load(relativePath: string) {
  const bytes = await readFile(path.join(projectRoot, relativePath));
  return {
    path: relativePath,
    bytes,
    sha256: sha256(bytes),
    value: JSON.parse(bytes.toString("utf8")) as JsonRecord,
  };
}

async function filesBelow(relativeRoot: string): Promise<string[]> {
  const absoluteRoot = path.join(projectRoot, relativeRoot);
  const result: string[] = [];
  const walk = async (directory: string) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(absolute);
      else if (entry.isFile()) result.push(path.relative(projectRoot, absolute));
    }
  };
  await walk(absoluteRoot);
  return result.sort();
}

function anchorText(markup: string): string {
  return normalizeVisibleDomValue(markup.replace(/<[^>]+>/gu, ""));
}

async function main() {
  const [
    corpus,
    quality,
    semantic,
    decisionSource,
    aiReview,
    browser,
    imageCampaign,
    imagePlan,
    generationLedger,
    providerAmendment,
  ] = await Promise.all([
    load("artifacts/content-corpus.json"),
    load("artifacts/content-quality-receipt.json"),
    load("artifacts/built-visible-contract-receipt.v1.json"),
    load("artifacts/content-ai-review-decisions.v1.json"),
    load("artifacts/content-ai-review.v1.json"),
    load("artifacts/local-chromium-qa.v1.json"),
    load("artifacts/image-campaign-contract.json"),
    load("artifacts/image-generation-plan.json"),
    load("pipeline/images/state/generation-manifest.json"),
    load("pipeline/images/state/provider-binding-amendment-v1.json"),
  ]);

  const semanticCounts = semantic.value.counts as JsonRecord | undefined;
  const semanticSeo = semantic.value.seo as JsonRecord | undefined;
  const seoCounts = semanticSeo?.counts as JsonRecord | undefined;
  const seoSitemap = semanticSeo?.sitemap as JsonRecord | undefined;
  const qualityViolations = quality.value.violations as unknown[] | undefined;
  if (
    corpus.value.status !== "COMPLETE" ||
    quality.value.status !== "PASS" ||
    !Array.isArray(qualityViolations) ||
    qualityViolations.length !== 0 ||
    semantic.value.status !== "PASS" ||
    semanticSeo?.status !== "PASS" ||
    semanticCounts?.routes !== 1301 ||
    semanticCounts?.failedRoutes !== 0 ||
    semanticCounts?.declaredButNotRenderedOccurrences !== 0 ||
    semanticCounts?.renderedButNotDeclaredOccurrences !== 0 ||
    seoCounts?.routes !== 1301 ||
    seoCounts?.fixedRoutes !== 10 ||
    seoCounts?.regionalRoutes !== 1291 ||
    seoCounts?.failedRoutes !== 0 ||
    seoSitemap?.actualUrls !== 1301 ||
    !Array.isArray(seoSitemap?.missing) ||
    seoSitemap.missing.length !== 0 ||
    !Array.isArray(seoSitemap?.extra) ||
    seoSitemap.extra.length !== 0
  ) {
    throw new Error("MASSAGE_LOVE_FAST_CANDIDATE_SEO_DOM_INPUT_INVALID");
  }

  const aiInputs = {
    corpus: corpus.value,
    corpusSha256: corpus.sha256,
    qualityReceiptSha256: quality.sha256,
    semanticReceipt: semantic.value,
    semanticReceiptSha256: semantic.sha256,
  };
  validateAiReviewReceipt(
    aiReview.value,
    decisionSource.value,
    decisionSource.sha256,
    aiInputs,
  );
  validateLocalChromiumReceipt(browser.value, {
    corpusSha256: corpus.sha256,
    qualitySha256: quality.sha256,
    semanticSha256: semantic.sha256,
    semanticCaseSetSha256: String(semanticCounts.semanticCaseSetSha256),
  });

  const entries = corpus.value.entries as JsonRecord[] | undefined;
  if (!Array.isArray(entries) || entries.length !== 1291) {
    throw new Error("MASSAGE_LOVE_FAST_CANDIDATE_REGION_GRAPH_INVALID");
  }
  const pageTypes = entries.reduce<Record<string, number>>((counts, entry) => {
    const pageType = String(entry.pageType);
    counts[pageType] = (counts[pageType] ?? 0) + 1;
    return counts;
  }, {});
  if (
    pageTypes["region-root"] !== 11 ||
    pageTypes["region-hub"] !== 127 ||
    pageTypes["region-representative"] !== 1153
  ) {
    throw new Error("MASSAGE_LOVE_FAST_CANDIDATE_REGION_KIND_COUNTS_INVALID");
  }

  const routeMarkups = buildSourceRouteMarkups();
  let telephoneLinks = 0;
  for (const route of routeMarkups) {
    const anchors = [
      ...route.markup.matchAll(/<a\b[^>]*href="(tel:[^"]+)"[^>]*>([\s\S]*?)<\/a>/gu),
    ];
    if (anchors.length === 0) {
      throw new Error(`MASSAGE_LOVE_FAST_CANDIDATE_TELEPHONE_LINK_MISSING:${route.route}`);
    }
    for (const anchor of anchors) {
      telephoneLinks += 1;
      if (anchor[1] !== BUSINESS.phoneHref || anchorText(anchor[2]) !== BUSINESS.phoneCtaLabel) {
        throw new Error(`MASSAGE_LOVE_FAST_CANDIDATE_TELEPHONE_LINK_INVALID:${route.route}`);
      }
    }
  }
  if (routeMarkups.length !== 1301 || telephoneLinks !== 5192) {
    throw new Error("MASSAGE_LOVE_FAST_CANDIDATE_TELEPHONE_COUNTS_INVALID");
  }
  if (
    BUSINESS.consultation !== "24시간 전화상담" ||
    BUSINESS.payment !== "선입금 없는 100% 현장 후불" ||
    BUSINESS.cardPayment !== "현장 카드 결제 가능" ||
    PRICE_ITEM_COUNT !== 14 ||
    COURSE_PRICING.length !== 5
  ) {
    throw new Error("MASSAGE_LOVE_FAST_CANDIDATE_BUSINESS_FACTS_INVALID");
  }

  const generationCounts = generationLedger.value.counts as JsonRecord | undefined;
  if (
    imageCampaign.value.status !== "PLANNED_NO_ASSETS" ||
    (imageCampaign.value.counts as JsonRecord | undefined)?.routes !== 1291 ||
    (imageCampaign.value.counts as JsonRecord | undefined)?.regionalImages !== 323 ||
    imagePlan.value.status !== "READY_FOR_COORDINATED_RUN" ||
    (imagePlan.value.counts as JsonRecord | undefined)?.jobs !== 324 ||
    generationCounts?.total !== 324 ||
    generationCounts?.planned !== 324 ||
    generationCounts?.active !== 0 ||
    generationCounts?.uncertain !== 0 ||
    generationCounts?.completed !== 0 ||
    generationCounts?.failed !== 0 ||
    generationCounts?.generationSubmissions !== 0
  ) {
    throw new Error("MASSAGE_LOVE_FAST_CANDIDATE_IMAGE_STATE_INVALID");
  }
  try {
    await access(path.join(projectRoot, "pipeline/images/release/image-release.json"));
    throw new Error("MASSAGE_LOVE_FAST_CANDIDATE_UNEXPECTED_IMAGE_RELEASE");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const publicFiles = await filesBelow("public");
  const expectedPublicFiles = ["public/favicon.svg", HOME_HERO_PUBLIC_PATH];
  if (JSON.stringify(publicFiles) !== JSON.stringify(expectedPublicFiles)) {
    throw new Error(`MASSAGE_LOVE_FAST_CANDIDATE_PUBLIC_FILES_INVALID:${JSON.stringify(publicFiles)}`);
  }
  const homeHeroBytes = await readFile(path.join(projectRoot, HOME_HERO_PUBLIC_PATH));
  if (sha256(homeHeroBytes) !== HOME_HERO_SHA256) {
    throw new Error("MASSAGE_LOVE_FAST_CANDIDATE_HOME_HERO_SHA_INVALID");
  }
  if (SITE_ORIGIN !== "https://msglove.kr") {
    throw new Error("MASSAGE_LOVE_FAST_CANDIDATE_PRODUCTION_ORIGIN_INVALID");
  }

  const receipt = {
    schemaVersion: "massage-love-fast-candidate/v1",
    status: "FAST_CANDIDATE",
    authority: {
      scope: "project-local-fast-candidate-evidence-only",
      projectLocalCandidate: true,
      publicGo: false,
      globalGo: false,
      deploymentAuthorized: false,
      humanApprovalClaimed: false,
      inAppBrowserClaimed: false,
    },
    bindings: {
      corpus: { path: corpus.path, sha256: corpus.sha256 },
      quality: { path: quality.path, sha256: quality.sha256 },
      builtSemantic: { path: semantic.path, sha256: semantic.sha256 },
      aiDecisionSource: { path: decisionSource.path, sha256: decisionSource.sha256 },
      aiContentReview: { path: aiReview.path, sha256: aiReview.sha256 },
      localChromiumQa: { path: browser.path, sha256: browser.sha256 },
      imageCampaign: { path: imageCampaign.path, sha256: imageCampaign.sha256 },
      imagePlan: { path: imagePlan.path, sha256: imagePlan.sha256 },
      generationLedger: { path: generationLedger.path, sha256: generationLedger.sha256 },
      providerAmendment: { path: providerAmendment.path, sha256: providerAmendment.sha256 },
    },
    actualContract: {
      routes: 1301,
      regionalRoutes: 1291,
      fixedRoutes: 10,
      visibleOccurrences: semanticCounts.renderedOccurrences,
      declaredButNotRenderedOccurrences: 0,
      renderedButNotDeclaredOccurrences: 0,
      seoFailures: 0,
      sitemapUrls: 1301,
      indexableRoutes: 1301,
      telephoneLinks,
      telephoneLabel: BUSINESS.phoneCtaLabel,
      telephoneHref: BUSINESS.phoneHref,
      courseCount: COURSE_PRICING.length,
      priceItems: PRICE_ITEM_COUNT,
      businessFacts: [BUSINESS.consultation, BUSINESS.payment, BUSINESS.cardPayment],
      regionGraph: pageTypes,
    },
    finalIntegrationInput: {
      platformId: "massage-love",
      corpusSha256: corpus.sha256,
      sourceManifestSha256: corpus.value.sourceManifestSha256,
      visibleActualSemanticReceiptSha256: semantic.sha256,
      visibleActualCaseSetSha256: semanticCounts.semanticCaseSetSha256,
      routes: 1301,
      regionalRoutes: 1291,
    },
    review: {
      type: "INDEPENDENT_AI_CONTENT_REVIEW",
      candidates: 82,
      approved: 82,
      empty: 0,
      human: false,
    },
    browser: {
      lane: "LOCAL_CHROMIUM_PLAYWRIGHT_FUNCTIONAL_QA",
      cases: 9,
      inAppBrowser: false,
      humanVisualReview: false,
      screenshotsCreated: 0,
    },
    images: {
      state: "PLANNED_NO_ASSETS",
      plannedJobs: 324,
      generationSubmissions: 0,
      activeJobs: 0,
      uncertainJobs: 0,
      completedJobs: 0,
      metaAiCalls: 0,
      publicHeroAssets: 0,
      publicFiles,
    },
    crossPlatform: {
      status: "PENDING_FINAL_INTEGRATION",
      releaseIntegrationPending: true,
      pendingCandidates: ["rang-therapy", "mixed-love-massage"],
      deployedBaselineExcludedFromThisPass: true,
    },
    publicLaunch: {
      siteOrigin: SITE_ORIGIN,
      metadataPolicy: "index, follow",
      deploymentPerformed: false,
    },
    pendingPromotionBoundaries: [
      "final Rang Therapy and Mixed Love Massage actual-surface comparison after all candidates freeze",
      "image canary, source QA, dedicated refinement, provenance, responsive QA, and atomic promotion",
      "legal, brand, operational-fact, and owner approval before deployment",
    ],
  };
  const contents = `${JSON.stringify(receipt, null, 2)}\n`;
  await writeFile(
    path.join(projectRoot, "artifacts/fast-candidate.v1.json"),
    contents,
    "utf8",
  );
  process.stdout.write(
    `${JSON.stringify({ status: receipt.status, receiptSha256: sha256(contents) })}\n`,
  );
}

await main();
