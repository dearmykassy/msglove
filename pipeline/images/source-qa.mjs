#!/usr/bin/env node

import path from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import {
  CROSS_PLATFORM_MAX_DHASH_DISTANCE,
  CROSS_PLATFORM_MAX_PHASH_DISTANCE,
  EXPECTED_JOB_COUNT,
  GENERATION_MANIFEST_PATH,
  PIPELINE_ROOT,
  PROJECT_ROOT,
  SOURCE_CONTACT_MANIFEST_PATH,
  SOURCE_MACHINE_REPORT_PATH,
  SOURCE_REVIEW_PATH,
  PipelineError,
  allChecksPass,
  atomicNoClobberBuffer,
  atomicNoClobberJson,
  dhash64,
  phash64,
  fileExists,
  hammingDhash,
  hammingPHash,
  imageMetadata,
  loadAndValidateContracts,
  readJsonFile,
  sourceImageChecks,
  validateGenerationManifest,
  verifyFileRecord,
} from "./lib.mjs";

export const SOURCE_REVIEW_CHECKS = Object.freeze([
  "no_people_bodies_body_parts_silhouettes_or_reflections",
  "no_beds_massage_beds_treatment_tables_or_bedrooms",
  "no_generated_text_letters_numbers_logos_signs_or_watermarks",
  "no_hearts_flowers_cherry_blossoms_stars_or_constellations",
  "no_explicit_suggestive_nightclub_or_kitsch_content",
  "single_coherent_realistic_architectural_photograph",
  "leftmost_45_percent_is_dark_low_detail_and_text_safe",
  "top_safe_area_is_clear_for_translucent_header",
  "right_half_contains_the_primary_architectural_focus",
  "no_malformed_or_duplicated_architecture_furniture_or_props",
  "mature_burgundy_rosewood_pearl_evening_lounge_direction",
  "source_is_landscape_16_9_and_natural",
]);

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

async function loadCompleteGeneration() {
  const contracts = await loadAndValidateContracts();
  const manifestFile = await readJsonFile(GENERATION_MANIFEST_PATH);
  const manifest = validateGenerationManifest(contracts, manifestFile.value);
  if (
    manifest.status !== "SOURCES_COMPLETE_AWAITING_QA" ||
    manifest.counts.completed !== EXPECTED_JOB_COUNT ||
    manifest.entries.some((entry) => entry.status !== "completed") ||
    typeof manifest.providerOutputRoot !== "string" ||
    !path.isAbsolute(manifest.providerOutputRoot)
  ) {
    throw new PipelineError(
      "ALL_SOURCES_REQUIRED",
      "source QA stays closed until all 324 generation entries are completed",
      { status: manifest.status, counts: manifest.counts },
    );
  }
  return { contracts, manifest, manifestFile };
}

function expandCodex(value, codexRoot) {
  return path.resolve(value.replaceAll("${CODEX_ROOT}", codexRoot));
}

export async function loadCrossPlatformIndex() {
  const governanceRoot = path.resolve(PROJECT_ROOT, "../platform-governance");
  const registryPath = path.join(governanceRoot, "contracts/platform-registry.v1.json");
  if (!(await fileExists(registryPath))) {
    throw new PipelineError(
      "GOVERNANCE_REGISTRY_MISSING",
      "cross-platform image QA requires the shared platform registry",
    );
  }
  const registryFile = await readJsonFile(registryPath);
  const codexRoot = path.dirname(governanceRoot);
  const records = [];
  for (const platform of registryFile.value.platforms ?? []) {
    if (platform.id === "massage-love") continue;
    const corpusPath = expandCodex(platform.corpusPath, codexRoot);
    const projectRoot = expandCodex(platform.projectRoot, codexRoot);
    if (!(await fileExists(corpusPath))) {
      throw new PipelineError(
        "CROSS_PLATFORM_CORPUS_MISSING",
        `${platform.id} corpus is missing`,
      );
    }
    const corpus = (await readJsonFile(corpusPath)).value;
    const images = corpus.images;
    if (!images || images.status !== "COMPLETE") {
      // A platform with no completed image release contributes no comparable public bytes yet.
      continue;
    }
    const assets = [images.home, ...(images.regionalAssets ?? [])];
    for (const asset of assets) {
      for (const publicFile of asset.publicFiles ?? []) {
        const absolute = path.join(projectRoot, "public", publicFile.publicPath.replace(/^\//, ""));
        const file = await verifyFileRecord(
          {
            path: absolute,
            sha256: publicFile.publicSha256,
            bytes: (await readFile(absolute)).length,
          },
          { allowedRoot: path.join(projectRoot, "public") },
        );
        const [perceptualHash, pHash] = await Promise.all([
          dhash64(file.bytes),
          phash64(file.bytes),
        ]);
        records.push({
          platformId: platform.id,
          assetId: asset.assetId,
          profile: publicFile.profile,
          path: file.path,
          sha256: file.sha256,
          perceptualHash,
          pHash,
        });
      }
    }
  }
  return {
    registryPath,
    registrySha256: registryFile.sha256,
    records,
  };
}

function duplicateEvidence(sources, external) {
  const within = [];
  const crossPlatform = [];
  for (let left = 0; left < sources.length; left += 1) {
    for (let right = left + 1; right < sources.length; right += 1) {
      const exact = sources[left].sourceSha256 === sources[right].sourceSha256;
      const dHashDistance = hammingDhash(
        sources[left].perceptualHash,
        sources[right].perceptualHash,
      );
      const pHashDistance = hammingPHash(sources[left].pHash, sources[right].pHash);
      if (
        exact ||
        dHashDistance <= CROSS_PLATFORM_MAX_DHASH_DISTANCE ||
        pHashDistance <= CROSS_PLATFORM_MAX_PHASH_DISTANCE
      ) {
        within.push({
          imageA: sources[left].imageId,
          imageB: sources[right].imageId,
          exactSha256: exact,
          dHashHammingDistance: dHashDistance,
          pHashHammingDistance: pHashDistance,
        });
      }
    }
  }
  for (const source of sources) {
    for (const other of external) {
      const exact = source.sourceSha256 === other.sha256;
      const dHashDistance = hammingDhash(source.perceptualHash, other.perceptualHash);
      const pHashDistance = hammingPHash(source.pHash, other.pHash);
      if (
        exact ||
        dHashDistance <= CROSS_PLATFORM_MAX_DHASH_DISTANCE ||
        pHashDistance <= CROSS_PLATFORM_MAX_PHASH_DISTANCE
      ) {
        crossPlatform.push({
          imageId: source.imageId,
          otherPlatformId: other.platformId,
          otherAssetId: other.assetId,
          otherProfile: other.profile,
          exactSha256: exact,
          dHashHammingDistance: dHashDistance,
          pHashHammingDistance: pHashDistance,
        });
      }
    }
  }
  return { within, crossPlatform };
}

export async function runSourceMachineQa() {
  const { contracts, manifest, manifestFile } = await loadCompleteGeneration();
  const external = await loadCrossPlatformIndex();
  const sources = [];
  for (const entry of manifest.entries) {
    const file = await verifyFileRecord(entry.files[0], {
      allowedRoot: path.join(manifest.providerOutputRoot, entry.outputSubdirectory),
    });
    const metadata = await imageMetadata(file.bytes);
    const checks = sourceImageChecks(metadata);
    const [perceptualHash, pHash] = await Promise.all([
      dhash64(file.bytes),
      phash64(file.bytes),
    ]);
    sources.push({
      order: entry.order,
      imageId: entry.imageId,
      clientRequestId: entry.clientRequestId,
      providerJobId: entry.providerJobId,
      providerLaneId: entry.providerLaneId,
      promptSha256: entry.promptSha256,
      sourcePath: file.path,
      sourceSha256: file.sha256,
      bytes: file.byteLength,
      metadata,
      perceptualHashAlgorithm: "dhash64-v1",
      perceptualHash,
      pHashAlgorithm: "phash64-dct-v1",
      pHash,
      checks,
      status: allChecksPass(checks) ? "PASS" : "FAIL",
    });
  }
  const duplicates = duplicateEvidence(sources, external.records);
  const status =
    sources.length === EXPECTED_JOB_COUNT &&
    sources.every((source) => source.status === "PASS") &&
    duplicates.within.length === 0 &&
    duplicates.crossPlatform.length === 0
      ? "PASS"
      : "FAIL";
  const report = {
    schemaVersion: "massage-love-source-machine-qa/v1",
    campaignId: "massage-love-image-campaign-v1",
    status,
    bindings: {
      generationManifestPath: path.relative(PROJECT_ROOT, GENERATION_MANIFEST_PATH),
      generationManifestSha256: manifestFile.sha256,
      planFileSha256: contracts.planFileSha256,
      campaignFileSha256: contracts.campaignFileSha256,
      governanceRegistryPath: external.registryPath,
      governanceRegistrySha256: external.registrySha256,
    },
    policy: {
      sourceCount: EXPECTED_JOB_COUNT,
      acceptedFormats: ["jpeg", "png", "webp"],
      minimumWidth: 1536,
      minimumHeight: 864,
      aspectRatio: "16:9",
      aspectRatioTolerance: 0.012,
      perceptualHashAlgorithm: "dhash64-v1",
      maximumAllowedDuplicateDistance: CROSS_PLATFORM_MAX_DHASH_DISTANCE,
      pHashAlgorithm: "phash64-dct-v1",
      maximumAllowedPHashDistance: CROSS_PLATFORM_MAX_PHASH_DISTANCE,
      crossPlatformExactShaAllowed: false,
      crossPlatformPerceptualDuplicateAllowed: false,
    },
    counts: {
      sources: sources.length,
      machinePass: sources.filter((source) => source.status === "PASS").length,
      machineFail: sources.filter((source) => source.status === "FAIL").length,
      externalPublicComparators: external.records.length,
      withinCampaignDuplicates: duplicates.within.length,
      crossPlatformDuplicates: duplicates.crossPlatform.length,
    },
    duplicates,
    sources,
  };
  await atomicNoClobberJson(SOURCE_MACHINE_REPORT_PATH, report);
  if (status !== "PASS") {
    throw new PipelineError("SOURCE_MACHINE_QA_FAILED", "source machine QA failed", {
      report: SOURCE_MACHINE_REPORT_PATH,
      counts: report.counts,
    });
  }
  return report;
}

async function thumbnail(sourcePath, width, height) {
  return sharp(sourcePath, { failOn: "warning" })
    .rotate()
    .resize(width, height, { fit: "cover", position: "centre" })
    .jpeg({ quality: 82, chromaSubsampling: "4:4:4" })
    .toBuffer();
}

export async function buildSourceContactSheets({ itemsPerSheet = 18 } = {}) {
  const machineFile = await readJsonFile(SOURCE_MACHINE_REPORT_PATH);
  const report = machineFile.value;
  if (
    report?.schemaVersion !== "massage-love-source-machine-qa/v1" ||
    report.status !== "PASS" ||
    report.sources?.length !== EXPECTED_JOB_COUNT
  ) {
    throw new PipelineError("SOURCE_QA_PASS_REQUIRED", "PASS source QA is required");
  }
  if (itemsPerSheet !== 18) {
    throw new PipelineError("CONTACT_SHEET_POLICY_INVALID", "source sheets are fixed at 18 images");
  }
  const columns = 6;
  const rows = 3;
  const thumbWidth = 300;
  const thumbHeight = 169;
  const labelHeight = 32;
  const gap = 8;
  const margin = 12;
  const sheetWidth = margin * 2 + columns * thumbWidth + (columns - 1) * gap;
  const sheetHeight = margin * 2 + rows * (thumbHeight + labelHeight) + (rows - 1) * gap;
  const sheets = [];
  for (let start = 0; start < report.sources.length; start += itemsPerSheet) {
    const batch = report.sources.slice(start, start + itemsPerSheet);
    const composites = [];
    for (const [offset, source] of batch.entries()) {
      const column = offset % columns;
      const row = Math.floor(offset / columns);
      const left = margin + column * (thumbWidth + gap);
      const top = margin + row * (thumbHeight + labelHeight + gap);
      composites.push({ input: await thumbnail(source.sourcePath, thumbWidth, thumbHeight), left, top });
      const label = Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${thumbWidth}" height="${labelHeight}"><rect width="100%" height="100%" fill="#211418"/><text x="10" y="22" fill="#f2ece7" font-size="15" font-family="Arial, sans-serif">${escapeXml(source.imageId)} · ${source.sourceSha256.slice(0, 12)}</text></svg>`,
      );
      composites.push({ input: label, left, top: top + thumbHeight });
    }
    const bytes = await sharp({
      create: {
        width: sheetWidth,
        height: sheetHeight,
        channels: 3,
        background: "#f2ece7",
      },
    })
      .composite(composites)
      .png({ compressionLevel: 9, adaptiveFiltering: false })
      .toBuffer();
    const number = String(sheets.length + 1).padStart(2, "0");
    const sheetPath = path.join(
      PIPELINE_ROOT,
      `qa/source-contact-sheets/source-sheet-${number}.png`,
    );
    const written = await atomicNoClobberBuffer(sheetPath, bytes);
    sheets.push({
      sheet: sheets.length + 1,
      path: path.relative(PROJECT_ROOT, sheetPath),
      sha256: written.sha256,
      bytes: written.bytes,
      imageIds: batch.map((source) => source.imageId),
      sourceSha256: batch.map((source) => source.sourceSha256),
    });
  }
  const manifest = {
    schemaVersion: "massage-love-source-contact-sheets/v1",
    status: "READY_FOR_HUMAN_REVIEW",
    sourceMachineReportPath: path.relative(PROJECT_ROOT, SOURCE_MACHINE_REPORT_PATH),
    sourceMachineReportSha256: machineFile.sha256,
    policy: { imagesPerSheet: 18, columns: 6, rows: 3, sheets: 18 },
    counts: { images: EXPECTED_JOB_COUNT, sheets: sheets.length },
    sheets,
  };
  await atomicNoClobberJson(SOURCE_CONTACT_MANIFEST_PATH, manifest);
  return manifest;
}

function parseReviewArgs(argv) {
  const valueAfter = (flag) => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : null;
  };
  return {
    decisions: valueAfter("--decisions"),
    reviewer: valueAfter("--reviewer"),
    reviewedAt: valueAfter("--reviewed-at"),
    confirm: valueAfter("--confirm"),
  };
}

export async function recordSourceHumanReview({ decisions, reviewer, reviewedAt, confirm }) {
  if (
    !path.isAbsolute(decisions ?? "") ||
    typeof reviewer !== "string" ||
    reviewer.trim().length < 3 ||
    Number.isNaN(Date.parse(reviewedAt ?? "")) ||
    confirm !== "I_REVIEWED_ALL_324_SOURCE_IMAGES"
  ) {
    throw new PipelineError(
      "HUMAN_REVIEW_AUTHORITY_INVALID",
      "absolute decisions path, reviewer, ISO reviewed-at, and exact confirmation are required",
    );
  }
  const [machineFile, contactFile, decisionsFile] = await Promise.all([
    readJsonFile(SOURCE_MACHINE_REPORT_PATH),
    readJsonFile(SOURCE_CONTACT_MANIFEST_PATH),
    readJsonFile(decisions),
  ]);
  if (machineFile.value.status !== "PASS" || contactFile.value.counts?.images !== 324) {
    throw new PipelineError("SOURCE_REVIEW_INPUT_INVALID", "source QA/contact sheets are incomplete");
  }
  const items = decisionsFile.value?.items;
  if (!Array.isArray(items) || items.length !== EXPECTED_JOB_COUNT) {
    throw new PipelineError("SOURCE_REVIEW_COUNT_INVALID", "decisions must cover 324 images");
  }
  const expected = new Map(
    machineFile.value.sources.map((source) => [source.imageId, source.sourceSha256]),
  );
  const ids = new Set();
  for (const item of items) {
    if (
      ids.has(item.imageId) ||
      expected.get(item.imageId) !== item.sourceSha256 ||
      Object.keys(item.checks ?? {}).sort().join("\0") !== [...SOURCE_REVIEW_CHECKS].sort().join("\0") ||
      SOURCE_REVIEW_CHECKS.some((key) => item.checks[key] !== true)
    ) {
      throw new PipelineError(
        "SOURCE_HUMAN_REVIEW_REJECTED",
        `${item?.imageId ?? "unknown"} is missing identity or an explicit true check`,
      );
    }
    ids.add(item.imageId);
  }
  const receipt = {
    schemaVersion: "massage-love-source-human-review/v1",
    campaignId: "massage-love-image-campaign-v1",
    status: "PASS",
    reviewer: reviewer.trim(),
    reviewedAt,
    confirmation: confirm,
    sourceMachineReportPath: path.relative(PROJECT_ROOT, SOURCE_MACHINE_REPORT_PATH),
    sourceMachineReportSha256: machineFile.sha256,
    contactSheetManifestPath: path.relative(PROJECT_ROOT, SOURCE_CONTACT_MANIFEST_PATH),
    contactSheetManifestSha256: contactFile.sha256,
    decisionsPath: decisions,
    decisionsSha256: decisionsFile.sha256,
    checklist: SOURCE_REVIEW_CHECKS,
    counts: { reviewed: items.length, approved: items.length, rejected: 0 },
    items,
  };
  await atomicNoClobberJson(SOURCE_REVIEW_PATH, receipt);
  return receipt;
}

async function status() {
  const paths = [
    GENERATION_MANIFEST_PATH,
    SOURCE_MACHINE_REPORT_PATH,
    SOURCE_CONTACT_MANIFEST_PATH,
    SOURCE_REVIEW_PATH,
  ];
  const records = [];
  for (const filePath of paths) {
    if (!(await fileExists(filePath))) {
      records.push({ path: path.relative(PROJECT_ROOT, filePath), exists: false });
      continue;
    }
    const file = await readJsonFile(filePath);
    records.push({
      path: path.relative(PROJECT_ROOT, filePath),
      exists: true,
      sha256: file.sha256,
      status: file.value.status,
      counts: file.value.counts,
    });
  }
  process.stdout.write(`${JSON.stringify({ metaCallsThisCommand: 0, records }, null, 2)}\n`);
}

async function main() {
  const [command = "status", ...rest] = process.argv.slice(2);
  if (command === "machine-qa") {
    const report = await runSourceMachineQa();
    process.stdout.write(`${JSON.stringify({ status: report.status, counts: report.counts })}\n`);
    return;
  }
  if (command === "contact-sheets") {
    const manifest = await buildSourceContactSheets();
    process.stdout.write(`${JSON.stringify({ status: manifest.status, counts: manifest.counts })}\n`);
    return;
  }
  if (command === "record-review") {
    const receipt = await recordSourceHumanReview(parseReviewArgs(rest));
    process.stdout.write(`${JSON.stringify({ status: receipt.status, counts: receipt.counts })}\n`);
    return;
  }
  if (command === "status") return status();
  throw new PipelineError("COMMAND_INVALID", `unknown source QA command: ${command}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(
      `${JSON.stringify({ code: error?.code ?? "UNKNOWN", message: error?.message ?? String(error), details: error?.details ?? null })}\n`,
    );
    process.exitCode = 1;
  });
}
