import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildHumanReviewTemplate,
  validatePendingHumanReviewTemplate,
} from "./human-review-contract";

type CorpusDocument = Record<string, unknown>;

type StringSets = {
  title: Set<string>;
  description: Set<string>;
  h1: Set<string>;
  body: Set<string>;
  sentence: Set<string>;
};

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifactRoot = path.join(projectRoot, "artifacts");
const loveCorpusPath = path.join(artifactRoot, "content-corpus.json");
const TELEPHONE_CTA_UI_EXCEPTION = "전화상담";

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function completeSentences(value: string): string[] {
  return value
    .split(/(?<=[.!?])\s+/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => /[.!?]$/u.test(sentence));
}

function strings(value: unknown): string[] {
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap(strings);
  }
  return [];
}

function documentsOf(corpus: Record<string, unknown>): CorpusDocument[] {
  const documents = corpus.documents ?? corpus.entries;
  if (!Array.isArray(documents)) throw new Error("CONTENT_CORPUS_DOCUMENTS_MISSING");
  return documents as CorpusDocument[];
}

function add(value: unknown, bucket: Set<string>): void {
  for (const item of strings(value)) bucket.add(item);
}

function extractStandardCorpus(corpus: Record<string, unknown>): StringSets {
  const result: StringSets = {
    title: new Set(),
    description: new Set(),
    h1: new Set(),
    body: new Set(),
    sentence: new Set(),
  };
  for (const document of documentsOf(corpus)) {
    add(document.title, result.title);
    add(document.description, result.description);
    add(document.h1, result.h1);
    add(document.hooks, result.body);
    for (const section of (document.sections as Record<string, unknown>[] | undefined) ?? []) {
      add(section.heading, result.body);
      add(section.paragraphs, result.body);
    }
    add(document.ctaLabels, result.body);
    const fields = document.fields as Record<string, unknown> | undefined;
    if (fields) {
      add(fields.title, result.title);
      add(fields.description, result.description);
      add(fields.h1, result.h1);
      add(fields.eyebrow, result.body);
      add(fields.headings, result.body);
      add(fields.paragraphs, result.body);
      add(fields.ctaLabels, result.body);
      add(fields.labels, result.body);
    }
    const rendered = document.rendered as Record<string, unknown> | undefined;
    if (rendered) {
      add(rendered.supplemental, result.body);
    }
  }
  for (const fixed of (corpus.fixedEntries as CorpusDocument[] | undefined) ?? []) {
    const fields = fixed.fields as Record<string, unknown>;
    add(fields.title, result.title);
    add(fields.description, result.description);
    add(fields.h1, result.h1);
    add(fields.eyebrow, result.body);
    add(fields.headings, result.body);
    add(fields.paragraphs, result.body);
    add(fields.ctaLabels, result.body);
    add(fields.labels, result.body);
  }
  for (const routeContract of
    (corpus.routeVisibleContracts as Array<{
      contract?: { entries?: Array<{ value?: unknown }> };
    }> | undefined) ?? []) {
    for (const entry of routeContract.contract?.entries ?? []) {
      add(entry.value, result.body);
    }
  }
  for (const value of [...result.description, ...result.body]) {
    for (const sentence of completeSentences(value)) result.sentence.add(sentence);
  }
  return result;
}

function intersection(left: Set<string>, right: Set<string>): string[] {
  return [...left].filter((value) => right.has(value)).sort();
}

function structuralRegionLabels(corpus: Record<string, unknown>): Set<string> {
  const labels = new Set<string>();
  for (const document of documentsOf(corpus)) {
    add(document.regionName, labels);
    add(document.regionAliases, labels);
  }
  return labels;
}

function assertTelephoneExceptionIsCtaOnly(corpus: Record<string, unknown>): void {
  const entries = [
    ...documentsOf(corpus),
    ...((corpus.fixedEntries as CorpusDocument[] | undefined) ?? []),
  ];
  let ctaOccurrences = 0;
  for (const entry of entries) {
    const fields = (entry.fields ?? entry) as Record<string, unknown>;
    const ctaLabels = strings(fields.ctaLabels);
    ctaOccurrences += ctaLabels.filter(
      (value) => value === TELEPHONE_CTA_UI_EXCEPTION,
    ).length;
    const nonCtaFields = { ...fields };
    delete nonCtaFields.ctaLabels;
    if (strings(nonCtaFields).includes(TELEPHONE_CTA_UI_EXCEPTION)) {
      throw new Error(
        `MASSAGE_LOVE_TELEPHONE_UI_EXCEPTION_OUTSIDE_CTA:${String(entry.route)}`,
      );
    }
  }
  if (ctaOccurrences !== 1297) {
    throw new Error(
      `MASSAGE_LOVE_TELEPHONE_UI_EXCEPTION_COUNT_INVALID:${ctaOccurrences}`,
    );
  }
}

function compare(left: StringSets, right: StringSets, authorizedBodyLabels: Set<string>) {
  const examples: Record<string, string[]> = {};
  const excludedAuthorizedExamples: Record<string, string[]> = {};
  const excludedAuthorizedCounts: Record<string, number> = {};
  const overlap = Object.fromEntries(
    (["title", "description", "h1", "body", "sentence"] as const).map((field) => {
      const rawValues = intersection(left[field], right[field]);
      const excluded = field === "body"
        ? rawValues.filter((value) => authorizedBodyLabels.has(value))
        : [];
      const values = rawValues.filter((value) => !authorizedBodyLabels.has(value));
      examples[field] = values.slice(0, 12);
      excludedAuthorizedExamples[field] = excluded.slice(0, 12);
      excludedAuthorizedCounts[field] = excluded.length;
      return [field, values.length];
    }),
  );
  return { overlap, examples, excludedAuthorizedCounts, excludedAuthorizedExamples };
}

async function loadCorpus(corpusPath: string) {
  const bytes = await readFile(corpusPath);
  return {
    path: corpusPath,
    bytes,
    sha256: sha256(bytes),
    corpus: JSON.parse(bytes.toString("utf8")) as Record<string, unknown>,
  };
}

async function main() {
  const love = await loadCorpus(loveCorpusPath);
  const loveSets = extractStandardCorpus(love.corpus);
  const loveStructuralRegionLabels = structuralRegionLabels(love.corpus);
  assertTelephoneExceptionIsCtaOnly(love.corpus);
  const authorizedBodyLabels = new Set([
    ...loveStructuralRegionLabels,
    TELEPHONE_CTA_UI_EXCEPTION,
  ]);
  const targets = [
    {
      platformId: "massagebom",
      path: "/Users/ssm/Documents/Codex/platform-governance/corpora/massagebom.content-corpus.json",
      expectedSha256: "0a1375e03d2e7107c420349e0832465bdbf70e710503fa9d8191c2324a0dddc9",
      approval: "STABLE_VERIFIED",
    },
  ] as const;
  const comparisons = [];
  for (const target of targets) {
    const loaded = await loadCorpus(target.path);
    const shaMatches = loaded.sha256 === target.expectedSha256;
    const comparison = compare(
      loveSets,
      extractStandardCorpus(loaded.corpus),
      authorizedBodyLabels,
    );
    const exactZero = Object.values(comparison.overlap).every((count) => count === 0);
    const stableApproved = target.approval === "STABLE_VERIFIED";
    comparisons.push({
      platformId: target.platformId,
      inputStatus: shaMatches
        ? target.approval
        : stableApproved
          ? "SHA_MISMATCH_REJECTED"
          : "MUTABLE_SUPERSEDED_FORENSIC_PIN",
      path: target.path,
      corpusSha256: loaded.sha256,
      expectedSha256: target.expectedSha256,
      documents: documentsOf(loaded.corpus).length,
      overlap: comparison.overlap,
      overlapExamples: comparison.examples,
      excludedAuthorizedBodyLabelOverlaps: comparison.excludedAuthorizedCounts,
      excludedAuthorizedBodyLabelExamples: comparison.excludedAuthorizedExamples,
      status:
        shaMatches && exactZero && stableApproved
          ? "PASS"
          : !stableApproved
            ? "PENDING_STABLE_INPUT"
            : shaMatches && exactZero
            ? "PENDING_INDEPENDENT_GO"
            : "FAIL",
    });
  }
  comparisons.push({
    platformId: "star-todaki",
    inputStatus: "MUTABLE_AWAITING_NEW_STABLE_SIGNAL",
    path: "/Users/ssm/Documents/Codex/star-todaki/artifacts/content-corpus.json",
    corpusSha256: null,
    expectedSha256: null,
    documents: null,
    overlap: null,
    overlapExamples: null,
    status: "PENDING_STABLE_INPUT",
  });
  comparisons.push({
    platformId: "mixed-love-massage",
    inputStatus: "AWAITING_INDEPENDENT_GO_STABLE_SIGNAL",
    path: "/Users/ssm/Documents/Codex/mixed-love-massage/artifacts/content-corpus.json",
    corpusSha256: null,
    expectedSha256: null,
    documents: null,
    overlap: null,
    overlapExamples: null,
    status: "PENDING_STABLE_INPUT",
  });
  comparisons.push({
    platformId: "rang-therapy",
    inputStatus: "MUTABLE_NOT_ACCEPTED",
    path: "/Users/ssm/Documents/Codex/rang-therapy/artifacts/content-corpus.json",
    corpusSha256: null,
    expectedSha256: null,
    documents: null,
    overlap: null,
    overlapExamples: null,
    status: "PENDING_STABLE_INPUT",
  });

  const requiredStable = comparisons.filter((entry) =>
    ["massagebom"].includes(entry.platformId),
  );
  if (requiredStable.some((entry) => entry.status !== "PASS")) {
    throw new Error(
      `MASSAGE_LOVE_CROSS_STABLE_EXACT_FAILURE:${JSON.stringify(requiredStable)}`,
    );
  }
  const receipt = {
    schemaVersion: "massage-love-cross-platform-exact-review/v3",
    reviewedAt: new Date().toISOString(),
    status: "PENDING_STABLE_INPUTS",
    policy: {
      exactTitleDescriptionH1BodySentence: "HARD_ZERO",
      normalizedSimilarity: "DIAGNOSTIC_ONLY_NATURAL_LANGUAGE_FIRST",
      markerOrNumberGaming: "FORBIDDEN",
      mutableInputHandling: "FAIL_CLOSED",
      structuralRegionLabels:
        "EXCLUDED_FROM_AUTHORED_BODY_ONLY; exact committed regionName/regionAliases data, never prose, headings, metadata, sentences, or generic labels",
      telephoneCtaUiException:
        "exact 전화상담 CTA label only; excluded from body overlap only, with no metadata, title, description, H1, heading, paragraph, or sentence waiver",
    },
    method: {
      exactComparisonUnit: "trimmed complete customer-facing string",
      sentenceSegmentation:
        "customer-facing descriptions and body strings split after period, question mark, or exclamation mark",
      bodyScope:
        "every route-visible element-bound direct text, reconstructed heading/paragraph/link/button/list/table/caption/blockquote block, aria-label, and non-empty alt entry plus metadata title/description/H1 declarations",
      actualVisibleCorpusIncluded: true,
      counting: "distinct exact overlaps",
      structuralRegionLabelExclusionCount: loveStructuralRegionLabels.size,
      structuralRegionLabelExclusionSha256: sha256(
        [...loveStructuralRegionLabels].sort().join("\n"),
      ),
      telephoneCtaUiException: TELEPHONE_CTA_UI_EXCEPTION,
      telephoneCtaUiExceptionAuthoredOccurrences: 1297,
    },
    massageLoveCorpus: {
      path: loveCorpusPath,
      sha256: love.sha256,
      documents: documentsOf(love.corpus).length,
      fixedDocuments: Array.isArray(love.corpus.fixedEntries)
        ? love.corpus.fixedEntries.length
        : 0,
      exactSetSizes: Object.fromEntries(
        Object.entries(loveSets).map(([field, values]) => [field, values.size]),
      ),
    },
    comparisons,
    blockingReason:
      "Star Todaki is being strengthened and has no accepted replacement stable SHA. Mixed Love Massage and Rang Therapy also await independent-GO stable inputs. Integration approval stays fail-closed until every final SHA is supplied.",
  };
  await writeFile(
    path.join(artifactRoot, "cross-platform-exact-review.v1.json"),
    `${JSON.stringify(receipt, null, 2)}\n`,
    "utf8",
  );

  const qualityBytes = await readFile(path.join(artifactRoot, "content-quality-receipt.json"));
  const quality = JSON.parse(qualityBytes.toString("utf8")) as {
    status?: string;
    violations?: unknown[];
  };
  if (quality.status !== "PASS" || (quality.violations?.length ?? 0) !== 0) {
    throw new Error("MASSAGE_LOVE_HUMAN_REVIEW_REQUIRES_PASSING_QUALITY_RECEIPT");
  }
  const builtBytes = await readFile(
    path.join(artifactRoot, "built-visible-contract-receipt.v1.json"),
  );
  const built = JSON.parse(builtBytes.toString("utf8")) as {
    schemaVersion?: string;
    status?: string;
    corpus?: { sha256?: string };
    counts?: Record<string, unknown>;
  };
  if (
    built.schemaVersion !==
      "massage-love-built-visible-semantic-contract-receipt/v4" ||
    built.status !== "PASS" ||
    built.corpus?.sha256 !== love.sha256 ||
    built.counts?.routes !== 1301 ||
    built.counts?.failedRoutes !== 0 ||
    built.counts?.declaredButNotRenderedOccurrences !== 0 ||
    built.counts?.renderedButNotDeclaredOccurrences !== 0
  ) {
    throw new Error("MASSAGE_LOVE_HUMAN_REVIEW_REQUIRES_EXACT_BUILT_DOM_CONTRACT");
  }
  const humanReceipt = buildHumanReviewTemplate({
    corpus: love.corpus,
    corpusSha256: love.sha256,
    qualityReceiptSha256: sha256(qualityBytes),
    semanticReceipt: built as Record<string, unknown>,
    semanticReceiptSha256: sha256(builtBytes),
  });
  validatePendingHumanReviewTemplate(humanReceipt, {
    corpus: love.corpus,
    corpusSha256: love.sha256,
    qualityReceiptSha256: sha256(qualityBytes),
    semanticReceipt: built as Record<string, unknown>,
    semanticReceiptSha256: sha256(builtBytes),
  });
  await writeFile(
    path.join(artifactRoot, "content-human-review.v1.json"),
    `${JSON.stringify(humanReceipt, null, 2)}\n`,
    "utf8",
  );
  process.stdout.write(
    `${JSON.stringify({
      crossStatus: receipt.status,
      humanStatus: humanReceipt.status,
      humanTemplateSha256: sha256(`${JSON.stringify(humanReceipt, null, 2)}\n`),
      coverage: humanReceipt.coverage,
    })}\n`,
  );
}

await main();
