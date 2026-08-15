#!/usr/bin/env node

import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import {
  CROSS_PLATFORM_MAX_DHASH_DISTANCE,
  CROSS_PLATFORM_MAX_PHASH_DISTANCE,
  EXPECTED_JOB_COUNT,
  EXPECTED_ROUTE_COUNT,
  HEADER_BINDING_PATH,
  IMAGE_RELEASE_PATH,
  PALETTE_MANIFEST_PATH,
  PIPELINE_ROOT,
  PROFILES,
  PROJECT_ROOT,
  REFINED_CONTACT_MANIFEST_PATH,
  REFINED_MACHINE_REPORT_PATH,
  REFINED_REVIEW_PATH,
  REFINEMENT_MANIFEST_PATH,
  REFINEMENT_RELEASE_RECEIPT_PATH,
  RUNTIME_RELEASE_PATH,
  SOURCE_CONTACT_MANIFEST_PATH,
  SOURCE_MACHINE_REPORT_PATH,
  SOURCE_RELEASE_RECEIPT_PATH,
  SOURCE_REVIEW_PATH,
  PipelineError,
  atomicNoClobberBuffer,
  atomicNoClobberJson,
  atomicReplaceJson,
  canonicalSha256,
  dhash64,
  phash64,
  extractTopPalette,
  fileExists,
  hammingDhash,
  hammingPHash,
  headerBinding,
  imageMetadata,
  isSha256,
  loadAndValidateContracts,
  readJsonFile,
  sha256,
  verifyFileRecord,
} from "./lib.mjs";
import { SOURCE_REVIEW_CHECKS, loadCrossPlatformIndex } from "./source-qa.mjs";

export const REFINED_REVIEW_CHECKS = Object.freeze([
  "desktop_crop_is_natural_and_preserves_left_copy_safe_area",
  "tablet_crop_is_natural_and_preserves_primary_architecture",
  "mobile_crop_is_natural_and_contains_no_malformed_details",
  "no_people_body_parts_beds_text_logos_or_forbidden_symbols_in_any_profile",
  "no_generated_defect_became_more_visible_after_refinement",
  "color_and_tonal_range_fit_burgundy_rosewood_pearl_direction",
  "top_18_percent_is_suitable_for_a_readable_translucent_header",
  "all_three_profiles_are_approved_for_public_placement",
]);

const PUBLIC_RELATIVE_ROOT = "images/massage-love-heroes/v1";
const PUBLIC_TARGET = path.join(PROJECT_ROOT, "public", PUBLIC_RELATIVE_ROOT);
const DEPLOYMENT_MANIFEST_RELATIVE = `${PUBLIC_RELATIVE_ROOT}/deployment-manifest.json`;

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function cropGeometry(sourceWidth, sourceHeight, profile) {
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = profile.width / profile.height;
  if (sourceRatio > targetRatio) {
    const width = Math.max(1, Math.round(sourceHeight * targetRatio));
    const desiredCenter = sourceWidth * profile.focusX;
    const left = Math.max(0, Math.min(sourceWidth - width, Math.round(desiredCenter - width / 2)));
    return { left, top: 0, width, height: sourceHeight };
  }
  const height = Math.max(1, Math.round(sourceWidth / targetRatio));
  const top = Math.max(0, Math.min(sourceHeight - height, Math.round((sourceHeight - height) / 2)));
  return { left: 0, top, width: sourceWidth, height };
}

export function validateApprovedSourceCoverage(contracts, sources) {
  if (!Array.isArray(sources) || sources.length !== EXPECTED_JOB_COUNT) {
    throw new PipelineError(
      "SOURCE_COVERAGE_INVALID",
      "refinement requires the exact 324 source records",
    );
  }
  const sourcePaths = new Set();
  const sourceHashes = new Set();
  for (const [index, source] of sources.entries()) {
    const job = contracts.plan.jobs[index];
    if (
      source.order !== job.order ||
      source.imageId !== job.imageId ||
      source.promptSha256 !== job.promptSha256 ||
      typeof source.sourcePath !== "string" ||
      !path.isAbsolute(source.sourcePath) ||
      !isSha256(source.sourceSha256) ||
      source.perceptualHashAlgorithm !== "dhash64-v1" ||
      !/^[a-f0-9]{16}$/.test(source.perceptualHash) ||
      source.pHashAlgorithm !== "phash64-dct-v1" ||
      !/^[a-f0-9]{16}$/.test(source.pHash) ||
      source.status !== "PASS"
    ) {
      throw new PipelineError(
        "SOURCE_COVERAGE_BINDING_INVALID",
        `${source?.imageId ?? index} does not match the immutable generation plan`,
      );
    }
    sourcePaths.add(source.sourcePath);
    sourceHashes.add(source.sourceSha256);
  }
  if (
    sourcePaths.size !== EXPECTED_JOB_COUNT ||
    sourceHashes.size !== EXPECTED_JOB_COUNT ||
    sources[0].imageId !== "MLV-HOME-001" ||
    sources.filter((source) => source.imageId === "MLV-HOME-001").length !== 1
  ) {
    throw new PipelineError(
      "SOURCE_COVERAGE_DUPLICATE",
      "home and all regional sources must be unique and complete",
    );
  }
  return sources;
}

export function validateRefinementCoverage(
  contracts,
  refinement,
  sourceMachineFile,
) {
  if (
    refinement?.schemaVersion !== "massage-love-responsive-refinement/v1" ||
    refinement.status !== "REFINED_AWAITING_MACHINE_AND_HUMAN_QA" ||
    refinement.bindings?.sourceMachineReportSha256 !== sourceMachineFile.sha256 ||
    refinement.counts?.assets !== EXPECTED_JOB_COUNT ||
    refinement.counts?.variants !== EXPECTED_JOB_COUNT * PROFILES.length ||
    !Array.isArray(refinement.assets) ||
    refinement.assets.length !== EXPECTED_JOB_COUNT
  ) {
    throw new PipelineError(
      "REFINEMENT_COVERAGE_INVALID",
      "refinement manifest is not exactly bound to all 324 approved sources",
    );
  }
  validateApprovedSourceCoverage(contracts, sourceMachineFile.value.sources);
  for (const [index, asset] of refinement.assets.entries()) {
    const source = sourceMachineFile.value.sources[index];
    if (
      asset.order !== source.order ||
      asset.assetId !== source.imageId ||
      asset.sourcePath !== source.sourcePath ||
      asset.sourceSha256 !== source.sourceSha256 ||
      !Array.isArray(asset.variants) ||
      asset.variants.length !== PROFILES.length
    ) {
      throw new PipelineError(
        "REFINEMENT_ASSET_BINDING_INVALID",
        `${asset?.assetId ?? index} is not bound to its approved source`,
      );
    }
    for (const [profileIndex, variant] of asset.variants.entries()) {
      const profile = PROFILES[profileIndex];
      const expectedPath = `pipeline/images/refined/v1/${asset.assetId}/${profile.profile}.webp`;
      if (
        variant.profile !== profile.profile ||
        variant.path !== expectedPath ||
        !isSha256(variant.sha256) ||
        !Number.isSafeInteger(variant.bytes) ||
        variant.bytes <= 0 ||
        variant.width !== profile.width ||
        variant.height !== profile.height ||
        variant.focusX !== profile.focusX ||
        variant.format !== "webp" ||
        variant.perceptualHashAlgorithm !== "dhash64-v1" ||
        !/^[a-f0-9]{16}$/.test(variant.perceptualHash) ||
        variant.pHashAlgorithm !== "phash64-dct-v1" ||
        !/^[a-f0-9]{16}$/.test(variant.pHash)
      ) {
        throw new PipelineError(
          "REFINEMENT_VARIANT_BINDING_INVALID",
          `${asset.assetId}/${variant?.profile ?? profileIndex} drifted from its fixed profile`,
        );
      }
    }
  }
  return refinement;
}

function validateSourceReviewReceipt(machineFile, reviewFile) {
  const expected = new Map(
    machineFile.value.sources.map((source) => [source.imageId, source.sourceSha256]),
  );
  const items = reviewFile.value.items;
  const ids = new Set();
  if (!Array.isArray(items) || items.length !== EXPECTED_JOB_COUNT) {
    throw new PipelineError(
      "SOURCE_REVIEW_RECEIPT_INVALID",
      "source review receipt must contain all 324 approvals",
    );
  }
  for (const item of items) {
    if (
      ids.has(item.imageId) ||
      expected.get(item.imageId) !== item.sourceSha256 ||
      Object.keys(item.checks ?? {}).sort().join("\0") !==
        [...SOURCE_REVIEW_CHECKS].sort().join("\0") ||
      SOURCE_REVIEW_CHECKS.some((key) => item.checks[key] !== true)
    ) {
      throw new PipelineError(
        "SOURCE_REVIEW_RECEIPT_INVALID",
        `${item?.imageId ?? "unknown"} is not an explicit source approval`,
      );
    }
    ids.add(item.imageId);
  }
}

function validateRefinedReviewReceipt(refinementFile, reviewFile) {
  const expected = new Map(
    refinementFile.value.assets.map((asset) => [
      asset.assetId,
      asset.variants.map((variant) => variant.sha256),
    ]),
  );
  const items = reviewFile.value.items;
  const ids = new Set();
  if (!Array.isArray(items) || items.length !== EXPECTED_JOB_COUNT) {
    throw new PipelineError(
      "REFINED_REVIEW_RECEIPT_INVALID",
      "refined review receipt must contain all 324 approvals",
    );
  }
  for (const item of items) {
    if (
      ids.has(item.assetId) ||
      JSON.stringify(item.variantSha256) !== JSON.stringify(expected.get(item.assetId)) ||
      Object.keys(item.checks ?? {}).sort().join("\0") !==
        [...REFINED_REVIEW_CHECKS].sort().join("\0") ||
      REFINED_REVIEW_CHECKS.some((key) => item.checks[key] !== true)
    ) {
      throw new PipelineError(
        "REFINED_REVIEW_RECEIPT_INVALID",
        `${item?.assetId ?? "unknown"} is not an explicit refined approval`,
      );
    }
    ids.add(item.assetId);
  }
}

async function loadApprovedSources() {
  const [contracts, machineFile, contactFile, reviewFile] = await Promise.all([
    loadAndValidateContracts(),
    readJsonFile(SOURCE_MACHINE_REPORT_PATH),
    readJsonFile(SOURCE_CONTACT_MANIFEST_PATH),
    readJsonFile(SOURCE_REVIEW_PATH),
  ]);
  if (
    machineFile.value.status !== "PASS" ||
    machineFile.value.sources?.length !== EXPECTED_JOB_COUNT ||
    contactFile.value.status !== "READY_FOR_HUMAN_REVIEW" ||
    contactFile.value.counts?.images !== EXPECTED_JOB_COUNT ||
    contactFile.value.sourceMachineReportSha256 !== machineFile.sha256 ||
    reviewFile.value.status !== "PASS" ||
    reviewFile.value.counts?.approved !== EXPECTED_JOB_COUNT ||
    reviewFile.value.sourceMachineReportSha256 !== machineFile.sha256 ||
    reviewFile.value.contactSheetManifestSha256 !== contactFile.sha256
  ) {
    throw new PipelineError(
      "SOURCE_HUMAN_PASS_REQUIRED",
      "all 324 source images need machine QA, contact sheets, and human approval",
    );
  }
  validateApprovedSourceCoverage(contracts, machineFile.value.sources);
  validateSourceReviewReceipt(machineFile, reviewFile);
  return { contracts, machineFile, contactFile, reviewFile };
}

async function renderProfile(sourcePath, geometry, profile) {
  return sharp(sourcePath, { failOn: "warning", limitInputPixels: 100_000_000 })
    .rotate()
    .extract(geometry)
    .resize(profile.width, profile.height, {
      fit: "fill",
      kernel: "lanczos3",
    })
    .removeAlpha()
    .webp({ quality: profile.quality, effort: 6, smartSubsample: true })
    .toBuffer();
}

export async function refineApprovedSources() {
  const approved = await loadApprovedSources();
  const assets = [];
  for (const source of approved.machineFile.value.sources) {
    const sourceFile = await verifyFileRecord({
      path: source.sourcePath,
      sha256: source.sourceSha256,
      bytes: source.bytes,
    });
    const metadata = await imageMetadata(sourceFile.bytes);
    const variants = [];
    for (const profile of PROFILES) {
      const geometry = cropGeometry(metadata.width, metadata.height, profile);
      const bytes = await renderProfile(source.sourcePath, geometry, profile);
      const [perceptualHash, pHash] = await Promise.all([
        dhash64(bytes),
        phash64(bytes),
      ]);
      const outputPath = path.join(
        PIPELINE_ROOT,
        `refined/v1/${source.imageId}/${profile.profile}.webp`,
      );
      const written = await atomicNoClobberBuffer(outputPath, bytes);
      const refinedMetadata = await imageMetadata(bytes);
      if (
        refinedMetadata.format !== "webp" ||
        refinedMetadata.width !== profile.width ||
        refinedMetadata.height !== profile.height
      ) {
        throw new PipelineError(
          "REFINED_PROFILE_INVALID",
          `${source.imageId}/${profile.profile} dimensions or format are invalid`,
        );
      }
      variants.push({
        profile: profile.profile,
        path: path.relative(PROJECT_ROOT, outputPath),
        sha256: written.sha256,
        bytes: written.bytes,
        width: profile.width,
        height: profile.height,
        sourceCrop: geometry,
        focusX: profile.focusX,
        format: "webp",
        perceptualHashAlgorithm: "dhash64-v1",
        perceptualHash,
        pHashAlgorithm: "phash64-dct-v1",
        pHash,
      });
    }
    assets.push({
      order: source.order,
      assetId: source.imageId,
      sourcePath: source.sourcePath,
      sourceSha256: source.sourceSha256,
      sourceWidth: metadata.width,
      sourceHeight: metadata.height,
      variants,
    });
  }
  const manifest = {
    schemaVersion: "massage-love-responsive-refinement/v1",
    campaignId: "massage-love-image-campaign-v1",
    status: "REFINED_AWAITING_MACHINE_AND_HUMAN_QA",
    bindings: {
      sourceMachineReportPath: path.relative(PROJECT_ROOT, SOURCE_MACHINE_REPORT_PATH),
      sourceMachineReportSha256: approved.machineFile.sha256,
      sourceHumanReviewPath: path.relative(PROJECT_ROOT, SOURCE_REVIEW_PATH),
      sourceHumanReviewSha256: approved.reviewFile.sha256,
    },
    policy: {
      engine: "sharp-0.34.5/libvips",
      metadataStripped: true,
      format: "webp",
      quality: 90,
      profiles: PROFILES,
      noUpscaleFromBelowMinimumSource: true,
    },
    counts: { assets: assets.length, variants: assets.length * PROFILES.length },
    assets,
  };
  await atomicNoClobberJson(REFINEMENT_MANIFEST_PATH, manifest);
  return manifest;
}

function withinRefinedDuplicates(files) {
  const duplicates = [];
  for (let left = 0; left < files.length; left += 1) {
    for (let right = left + 1; right < files.length; right += 1) {
      if (files[left].assetId === files[right].assetId) continue;
      const exact = files[left].sha256 === files[right].sha256;
      const dHashDistance = hammingDhash(
        files[left].perceptualHash,
        files[right].perceptualHash,
      );
      const pHashDistance = hammingPHash(files[left].pHash, files[right].pHash);
      if (
        exact ||
        dHashDistance <= CROSS_PLATFORM_MAX_DHASH_DISTANCE ||
        pHashDistance <= CROSS_PLATFORM_MAX_PHASH_DISTANCE
      ) {
        duplicates.push({
          assetA: files[left].assetId,
          profileA: files[left].profile,
          assetB: files[right].assetId,
          profileB: files[right].profile,
          exactSha256: exact,
          dHashHammingDistance: dHashDistance,
          pHashHammingDistance: pHashDistance,
        });
      }
    }
  }
  return duplicates;
}

export async function runRefinedMachineQa() {
  const [contracts, refinementFile, sourceMachineFile] = await Promise.all([
    loadAndValidateContracts(),
    readJsonFile(REFINEMENT_MANIFEST_PATH),
    readJsonFile(SOURCE_MACHINE_REPORT_PATH),
  ]);
  const refinement = refinementFile.value;
  validateRefinementCoverage(contracts, refinement, sourceMachineFile);
  const external = await loadCrossPlatformIndex();
  const files = [];
  for (const asset of refinement.assets) {
    for (const variant of asset.variants) {
      const absolute = path.join(PROJECT_ROOT, variant.path);
      const file = await verifyFileRecord(
        { path: absolute, sha256: variant.sha256, bytes: variant.bytes },
        { allowedRoot: path.join(PIPELINE_ROOT, "refined/v1") },
      );
      const metadata = await imageMetadata(file.bytes);
      const expected = PROFILES.find((profile) => profile.profile === variant.profile);
      const [actualPerceptualHash, actualPHash] = await Promise.all([
        dhash64(file.bytes),
        phash64(file.bytes),
      ]);
      const checks = {
        decodableWebp: metadata.format === "webp",
        exactWidth: metadata.width === expected?.width,
        exactHeight: metadata.height === expected?.height,
        digestBound: file.sha256 === variant.sha256,
        perceptualHashBound: actualPerceptualHash === variant.perceptualHash,
        pHashBound: actualPHash === variant.pHash,
      };
      files.push({
        assetId: asset.assetId,
        profile: variant.profile,
        path: absolute,
        sha256: file.sha256,
        bytes: file.byteLength,
        perceptualHash: actualPerceptualHash,
        pHash: actualPHash,
        checks,
        status: Object.values(checks).every(Boolean) ? "PASS" : "FAIL",
      });
    }
  }
  const within = withinRefinedDuplicates(files);
  const crossPlatform = [];
  for (const file of files) {
    for (const other of external.records) {
      const exact = file.sha256 === other.sha256;
      const dHashDistance = hammingDhash(file.perceptualHash, other.perceptualHash);
      const pHashDistance = hammingPHash(file.pHash, other.pHash);
      if (
        exact ||
        dHashDistance <= CROSS_PLATFORM_MAX_DHASH_DISTANCE ||
        pHashDistance <= CROSS_PLATFORM_MAX_PHASH_DISTANCE
      ) {
        crossPlatform.push({
          assetId: file.assetId,
          profile: file.profile,
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
  const status =
    files.length === EXPECTED_JOB_COUNT * PROFILES.length &&
    files.every((file) => file.status === "PASS") &&
    within.length === 0 &&
    crossPlatform.length === 0
      ? "PASS"
      : "FAIL";
  const report = {
    schemaVersion: "massage-love-refined-machine-qa/v1",
    campaignId: "massage-love-image-campaign-v1",
    status,
    bindings: {
      refinementManifestPath: path.relative(PROJECT_ROOT, REFINEMENT_MANIFEST_PATH),
      refinementManifestSha256: refinementFile.sha256,
      governanceRegistryPath: external.registryPath,
      governanceRegistrySha256: external.registrySha256,
    },
    policy: {
      profiles: PROFILES,
      perceptualHashAlgorithm: "dhash64-v1",
      maximumAllowedDuplicateDistance: CROSS_PLATFORM_MAX_DHASH_DISTANCE,
      pHashAlgorithm: "phash64-dct-v1",
      maximumAllowedPHashDistance: CROSS_PLATFORM_MAX_PHASH_DISTANCE,
    },
    counts: {
      assets: EXPECTED_JOB_COUNT,
      files: files.length,
      pass: files.filter((file) => file.status === "PASS").length,
      fail: files.filter((file) => file.status === "FAIL").length,
      withinCampaignDuplicates: within.length,
      crossPlatformDuplicates: crossPlatform.length,
      externalPublicComparators: external.records.length,
    },
    duplicates: { within, crossPlatform },
    files,
  };
  await atomicNoClobberJson(REFINED_MACHINE_REPORT_PATH, report);
  if (status !== "PASS") {
    throw new PipelineError("REFINED_MACHINE_QA_FAILED", "refined machine QA failed", {
      counts: report.counts,
      report: REFINED_MACHINE_REPORT_PATH,
    });
  }
  return report;
}

async function contactThumb(filePath, width = 276, height = 170) {
  return sharp(filePath, { failOn: "warning" })
    .resize(width, height, { fit: "contain", background: "#181114" })
    .jpeg({ quality: 82, chromaSubsampling: "4:4:4" })
    .toBuffer();
}

export async function buildRefinedContactSheets() {
  const [contracts, machineFile, refinementFile, sourceMachineFile] = await Promise.all([
    loadAndValidateContracts(),
    readJsonFile(REFINED_MACHINE_REPORT_PATH),
    readJsonFile(REFINEMENT_MANIFEST_PATH),
    readJsonFile(SOURCE_MACHINE_REPORT_PATH),
  ]);
  validateRefinementCoverage(contracts, refinementFile.value, sourceMachineFile);
  if (
    machineFile.value.status !== "PASS" ||
    machineFile.value.bindings?.refinementManifestSha256 !== refinementFile.sha256 ||
    refinementFile.value.counts?.assets !== EXPECTED_JOB_COUNT
  ) {
    throw new PipelineError("REFINED_QA_PASS_REQUIRED", "PASS refined machine QA is required");
  }
  const assetsPerSheet = 9;
  const columns = 3;
  const rows = 9;
  const cellWidth = 276;
  const cellHeight = 170;
  const labelHeight = 28;
  const gap = 7;
  const margin = 12;
  const sheetWidth = margin * 2 + columns * cellWidth + (columns - 1) * gap;
  const sheetHeight = margin * 2 + rows * (cellHeight + labelHeight) + (rows - 1) * gap;
  const sheets = [];
  for (let start = 0; start < refinementFile.value.assets.length; start += assetsPerSheet) {
    const assets = refinementFile.value.assets.slice(start, start + assetsPerSheet);
    const composites = [];
    for (const [row, asset] of assets.entries()) {
      for (const [column, variant] of asset.variants.entries()) {
        const left = margin + column * (cellWidth + gap);
        const top = margin + row * (cellHeight + labelHeight + gap);
        composites.push({
          input: await contactThumb(path.join(PROJECT_ROOT, variant.path), cellWidth, cellHeight),
          left,
          top,
        });
        composites.push({
          input: Buffer.from(
            `<svg xmlns="http://www.w3.org/2000/svg" width="${cellWidth}" height="${labelHeight}"><rect width="100%" height="100%" fill="#321a20"/><text x="8" y="19" fill="#f2ece7" font-size="13" font-family="Arial, sans-serif">${escapeXml(asset.assetId)} · ${escapeXml(variant.profile)}</text></svg>`,
          ),
          left,
          top: top + cellHeight,
        });
      }
    }
    const bytes = await sharp({
      create: { width: sheetWidth, height: sheetHeight, channels: 3, background: "#f2ece7" },
    })
      .composite(composites)
      .png({ compressionLevel: 9, adaptiveFiltering: false })
      .toBuffer();
    const number = String(sheets.length + 1).padStart(2, "0");
    const sheetPath = path.join(
      PIPELINE_ROOT,
      `qa/refined-contact-sheets/refined-sheet-${number}.png`,
    );
    const written = await atomicNoClobberBuffer(sheetPath, bytes);
    sheets.push({
      sheet: sheets.length + 1,
      path: path.relative(PROJECT_ROOT, sheetPath),
      sha256: written.sha256,
      bytes: written.bytes,
      assetIds: assets.map((asset) => asset.assetId),
      variantSha256: assets.flatMap((asset) => asset.variants.map((variant) => variant.sha256)),
    });
  }
  const manifest = {
    schemaVersion: "massage-love-refined-contact-sheets/v1",
    status: "READY_FOR_HUMAN_REVIEW",
    refinedMachineReportPath: path.relative(PROJECT_ROOT, REFINED_MACHINE_REPORT_PATH),
    refinedMachineReportSha256: machineFile.sha256,
    refinementManifestPath: path.relative(PROJECT_ROOT, REFINEMENT_MANIFEST_PATH),
    refinementManifestSha256: refinementFile.sha256,
    policy: { assetsPerSheet, profilesPerAsset: 3, columns, rows, sheets: 36 },
    counts: { assets: EXPECTED_JOB_COUNT, variants: EXPECTED_JOB_COUNT * 3, sheets: sheets.length },
    sheets,
  };
  await atomicNoClobberJson(REFINED_CONTACT_MANIFEST_PATH, manifest);
  return manifest;
}

export async function recordRefinedHumanReview({ decisions, reviewer, reviewedAt, confirm }) {
  if (
    !path.isAbsolute(decisions ?? "") ||
    typeof reviewer !== "string" ||
    reviewer.trim().length < 3 ||
    Number.isNaN(Date.parse(reviewedAt ?? "")) ||
    confirm !== "I_REVIEWED_ALL_324_REFINED_ASSETS"
  ) {
    throw new PipelineError("REFINED_REVIEW_AUTHORITY_INVALID", "refined review authority is invalid");
  }
  const [contracts, machineFile, contactFile, refinementFile, sourceMachineFile, decisionsFile] = await Promise.all([
    loadAndValidateContracts(),
    readJsonFile(REFINED_MACHINE_REPORT_PATH),
    readJsonFile(REFINED_CONTACT_MANIFEST_PATH),
    readJsonFile(REFINEMENT_MANIFEST_PATH),
    readJsonFile(SOURCE_MACHINE_REPORT_PATH),
    readJsonFile(decisions),
  ]);
  validateRefinementCoverage(contracts, refinementFile.value, sourceMachineFile);
  if (
    machineFile.value.status !== "PASS" ||
    contactFile.value.status !== "READY_FOR_HUMAN_REVIEW" ||
    contactFile.value.refinedMachineReportSha256 !== machineFile.sha256 ||
    contactFile.value.refinementManifestSha256 !== refinementFile.sha256
  ) {
    throw new PipelineError("REFINED_REVIEW_INPUT_INVALID", "refined review inputs are not bound");
  }
  const expected = new Map(
    refinementFile.value.assets.map((asset) => [
      asset.assetId,
      asset.variants.map((variant) => variant.sha256),
    ]),
  );
  const items = decisionsFile.value?.items;
  const ids = new Set();
  if (!Array.isArray(items) || items.length !== EXPECTED_JOB_COUNT) {
    throw new PipelineError("REFINED_REVIEW_COUNT_INVALID", "decisions must cover 324 assets");
  }
  for (const item of items) {
    if (
      ids.has(item.assetId) ||
      JSON.stringify(item.variantSha256) !== JSON.stringify(expected.get(item.assetId)) ||
      Object.keys(item.checks ?? {}).sort().join("\0") !== [...REFINED_REVIEW_CHECKS].sort().join("\0") ||
      REFINED_REVIEW_CHECKS.some((key) => item.checks[key] !== true)
    ) {
      throw new PipelineError(
        "REFINED_HUMAN_REVIEW_REJECTED",
        `${item?.assetId ?? "unknown"} lacks exact identity or explicit true checks`,
      );
    }
    ids.add(item.assetId);
  }
  const receipt = {
    schemaVersion: "massage-love-refined-human-review/v1",
    campaignId: "massage-love-image-campaign-v1",
    status: "PASS",
    reviewer: reviewer.trim(),
    reviewedAt,
    confirmation: confirm,
    refinedMachineReportPath: path.relative(PROJECT_ROOT, REFINED_MACHINE_REPORT_PATH),
    refinedMachineReportSha256: machineFile.sha256,
    refinementManifestPath: path.relative(PROJECT_ROOT, REFINEMENT_MANIFEST_PATH),
    refinementManifestSha256: refinementFile.sha256,
    contactSheetManifestPath: path.relative(PROJECT_ROOT, REFINED_CONTACT_MANIFEST_PATH),
    contactSheetManifestSha256: contactFile.sha256,
    decisionsPath: decisions,
    decisionsSha256: decisionsFile.sha256,
    checklist: REFINED_REVIEW_CHECKS,
    counts: { reviewed: items.length, approved: items.length, rejected: 0 },
    items,
  };
  await atomicNoClobberJson(REFINED_REVIEW_PATH, receipt);
  return receipt;
}

async function loadApprovedRefinement() {
  const [
    contracts,
    sourceMachine,
    sourceContact,
    sourceReview,
    refinement,
    refinedMachine,
    refinedContact,
    refinedReview,
  ] = await Promise.all([
    loadAndValidateContracts(),
    readJsonFile(SOURCE_MACHINE_REPORT_PATH),
    readJsonFile(SOURCE_CONTACT_MANIFEST_PATH),
    readJsonFile(SOURCE_REVIEW_PATH),
    readJsonFile(REFINEMENT_MANIFEST_PATH),
    readJsonFile(REFINED_MACHINE_REPORT_PATH),
    readJsonFile(REFINED_CONTACT_MANIFEST_PATH),
    readJsonFile(REFINED_REVIEW_PATH),
  ]);
  validateRefinementCoverage(contracts, refinement.value, sourceMachine);
  if (
    sourceMachine.value.status !== "PASS" ||
    sourceMachine.value.counts?.sources !== EXPECTED_JOB_COUNT ||
    sourceMachine.value.counts?.machineFail !== 0 ||
    sourceMachine.value.counts?.withinCampaignDuplicates !== 0 ||
    sourceMachine.value.counts?.crossPlatformDuplicates !== 0 ||
    sourceContact.value.status !== "READY_FOR_HUMAN_REVIEW" ||
    sourceContact.value.sourceMachineReportSha256 !== sourceMachine.sha256 ||
    sourceContact.value.counts?.images !== EXPECTED_JOB_COUNT ||
    sourceReview.value.status !== "PASS" ||
    sourceReview.value.confirmation !== "I_REVIEWED_ALL_324_SOURCE_IMAGES" ||
    sourceReview.value.sourceMachineReportSha256 !== sourceMachine.sha256 ||
    sourceReview.value.contactSheetManifestSha256 !== sourceContact.sha256 ||
    sourceReview.value.counts?.approved !== EXPECTED_JOB_COUNT ||
    sourceReview.value.counts?.rejected !== 0 ||
    sourceReview.value.items?.length !== EXPECTED_JOB_COUNT ||
    refinement.value.counts?.assets !== EXPECTED_JOB_COUNT ||
    refinement.value.bindings?.sourceHumanReviewSha256 !== sourceReview.sha256 ||
    refinedMachine.value.status !== "PASS" ||
    refinedMachine.value.bindings?.refinementManifestSha256 !== refinement.sha256 ||
    refinedMachine.value.counts?.pass !== EXPECTED_JOB_COUNT * PROFILES.length ||
    refinedMachine.value.counts?.fail !== 0 ||
    refinedMachine.value.counts?.withinCampaignDuplicates !== 0 ||
    refinedMachine.value.counts?.crossPlatformDuplicates !== 0 ||
    refinedContact.value.status !== "READY_FOR_HUMAN_REVIEW" ||
    refinedContact.value.refinementManifestSha256 !== refinement.sha256 ||
    refinedContact.value.refinedMachineReportSha256 !== refinedMachine.sha256 ||
    refinedContact.value.counts?.assets !== EXPECTED_JOB_COUNT ||
    refinedContact.value.counts?.variants !== EXPECTED_JOB_COUNT * PROFILES.length ||
    refinedReview.value.status !== "PASS" ||
    refinedReview.value.confirmation !== "I_REVIEWED_ALL_324_REFINED_ASSETS" ||
    refinedReview.value.refinementManifestSha256 !== refinement.sha256 ||
    refinedReview.value.refinedMachineReportSha256 !== refinedMachine.sha256 ||
    refinedReview.value.contactSheetManifestSha256 !== refinedContact.sha256 ||
    refinedReview.value.counts?.approved !== EXPECTED_JOB_COUNT ||
    refinedReview.value.counts?.rejected !== 0 ||
    refinedReview.value.items?.length !== EXPECTED_JOB_COUNT
  ) {
    throw new PipelineError(
      "ALL_IMAGE_APPROVALS_REQUIRED",
      "promotion requires 324 source and 324 refined human approvals",
    );
  }
  validateSourceReviewReceipt(sourceMachine, sourceReview);
  validateRefinedReviewReceipt(refinement, refinedReview);
  return {
    sourceMachine,
    sourceContact,
    sourceReview,
    refinement,
    refinedMachine,
    refinedContact,
    refinedReview,
  };
}

async function buildReleaseReceipts(approved) {
  const sourceReceipt = {
    schemaVersion: "massage-love-source-release-receipt/v1",
    campaignId: "massage-love-image-campaign-v1",
    status: "APPROVED",
    sourceMachineReportPath: path.relative(PROJECT_ROOT, SOURCE_MACHINE_REPORT_PATH),
    sourceMachineReportSha256: approved.sourceMachine.sha256,
    sourceHumanReviewPath: path.relative(PROJECT_ROOT, SOURCE_REVIEW_PATH),
    sourceHumanReviewSha256: approved.sourceReview.sha256,
    assets: approved.sourceMachine.value.sources.map((source) => ({
      assetId: source.imageId,
      sourcePath: source.sourcePath,
      sourceSha256: source.sourceSha256,
      perceptualHashAlgorithm: "dhash64-v1",
      perceptualHash: source.perceptualHash,
      pHashAlgorithm: "phash64-dct-v1",
      pHash: source.pHash,
    })),
  };
  const sourceWritten = await atomicNoClobberJson(SOURCE_RELEASE_RECEIPT_PATH, sourceReceipt);
  const refinementReceipt = {
    schemaVersion: "massage-love-refinement-release-receipt/v1",
    campaignId: "massage-love-image-campaign-v1",
    status: "APPROVED",
    refinementManifestPath: path.relative(PROJECT_ROOT, REFINEMENT_MANIFEST_PATH),
    refinementManifestSha256: approved.refinement.sha256,
    refinedMachineReportPath: path.relative(PROJECT_ROOT, REFINED_MACHINE_REPORT_PATH),
    refinedMachineReportSha256: approved.refinedMachine.sha256,
    refinedHumanReviewPath: path.relative(PROJECT_ROOT, REFINED_REVIEW_PATH),
    refinedHumanReviewSha256: approved.refinedReview.sha256,
    assets: approved.refinement.value.assets.map((asset) => ({
      assetId: asset.assetId,
      sourceSha256: asset.sourceSha256,
      variants: asset.variants.map((variant) => ({
        profile: variant.profile,
        path: variant.path,
        sha256: variant.sha256,
        perceptualHashAlgorithm: "dhash64-v1",
        perceptualHash: variant.perceptualHash,
        pHashAlgorithm: "phash64-dct-v1",
        pHash: variant.pHash,
      })),
    })),
  };
  const refinementWritten = await atomicNoClobberJson(
    REFINEMENT_RELEASE_RECEIPT_PATH,
    refinementReceipt,
  );
  return { sourceWritten, refinementWritten };
}

async function buildPalettesAndBindings(contracts, approved) {
  const palettes = [];
  for (const asset of approved.refinement.value.assets) {
    const desktop = asset.variants.find((variant) => variant.profile === "desktop");
    const absolute = path.join(PROJECT_ROOT, desktop.path);
    const palette = await extractTopPalette(absolute, desktop.sha256);
    palettes.push({ assetId: asset.assetId, palette, paletteSha256: canonicalSha256(palette) });
  }
  const paletteMap = new Map(palettes.map((entry) => [entry.assetId, entry.palette]));
  const assignments = contracts.campaign.assignments.map((assignment) => {
    const palette = paletteMap.get(assignment.imageId);
    if (!palette) throw new PipelineError("PALETTE_ASSET_MISSING", assignment.imageId);
    return {
      route: assignment.route,
      assetId: assignment.imageId,
      palette,
      headerBinding: headerBinding({ assetId: assignment.imageId, route: assignment.route, palette }),
    };
  });
  const homePalette = paletteMap.get("MLV-HOME-001");
  const home = {
    route: "/",
    assetId: "MLV-HOME-001",
    palette: homePalette,
    headerBinding: headerBinding({ assetId: "MLV-HOME-001", route: "/", palette: homePalette }),
  };
  const paletteManifest = {
    schemaVersion: "massage-love-top-palette/v1",
    status: "COMPLETE",
    policy: { algorithm: "top-18-percent-quantized-rgb-v1", topFraction: 0.18 },
    counts: { assets: palettes.length },
    palettes,
  };
  const paletteWritten = await atomicNoClobberJson(PALETTE_MANIFEST_PATH, paletteManifest);
  const bindingManifest = {
    schemaVersion: "massage-love-route-header-bindings/v1",
    status: "COMPLETE",
    paletteManifestPath: path.relative(PROJECT_ROOT, PALETTE_MANIFEST_PATH),
    paletteManifestSha256: paletteWritten.sha256,
    policy: {
      alphaMinimum: 0.88,
      alphaMaximum: 0.94,
      translucent: true,
      routes: EXPECTED_ROUTE_COUNT,
    },
    home,
    assignments,
  };
  const bindingWritten = await atomicNoClobberJson(HEADER_BINDING_PATH, bindingManifest);
  return { palettes, paletteWritten, bindingManifest, bindingWritten };
}

function publicFilesForAsset(asset) {
  return asset.variants.map((variant) => ({
    profile: variant.profile,
    publicPath: `/${PUBLIC_RELATIVE_ROOT}/${asset.assetId}/${variant.profile}.webp`,
    publicSha256: variant.sha256,
    bytes: variant.bytes,
    perceptualHashAlgorithm: "dhash64-v1",
    perceptualHash: variant.perceptualHash,
    pHashAlgorithm: "phash64-dct-v1",
    pHash: variant.pHash,
  }));
}

function governancePublicFilesForAsset(asset) {
  return publicFilesForAsset(asset).map(
    ({ profile, publicPath, publicSha256, perceptualHashAlgorithm, perceptualHash }) => ({
      profile,
      publicPath,
      publicSha256,
      perceptualHashAlgorithm,
      perceptualHash,
    }),
  );
}

async function verifyDeploymentTree(root, deployment, deploymentSha256) {
  const resolvedRoot = await realpath(root);
  const deploymentPath = path.join(resolvedRoot, "deployment-manifest.json");
  const deploymentBytes = await lstat(deploymentPath).then(async (metadata) => {
    if (!metadata.isFile() || metadata.isSymbolicLink()) {
      throw new PipelineError(
        "PUBLIC_DEPLOYMENT_MANIFEST_INVALID",
        "deployment manifest must be a regular non-symlink file",
      );
    }
    return metadata.size;
  });
  await verifyFileRecord(
    {
      path: deploymentPath,
      sha256: deploymentSha256,
      bytes: deploymentBytes,
    },
    { allowedRoot: resolvedRoot },
  );
  const publicPrefix = `/${PUBLIC_RELATIVE_ROOT}/`;
  for (const asset of deployment.assets) {
    for (const publicFile of asset.publicFiles) {
      if (
        typeof publicFile.publicPath !== "string" ||
        !publicFile.publicPath.startsWith(publicPrefix)
      ) {
        throw new PipelineError(
          "PUBLIC_DEPLOYMENT_PATH_INVALID",
          `${asset.assetId} has an invalid public path`,
        );
      }
      const relative = publicFile.publicPath.slice(publicPrefix.length);
      const file = await verifyFileRecord(
        {
          path: path.join(resolvedRoot, relative),
          sha256: publicFile.publicSha256,
          bytes: publicFile.bytes,
        },
        { allowedRoot: resolvedRoot },
      );
      const [actualPerceptualHash, actualPHash] = await Promise.all([
        dhash64(file.bytes),
        phash64(file.bytes),
      ]);
      if (
        actualPerceptualHash !== publicFile.perceptualHash ||
        actualPHash !== publicFile.pHash
      ) {
        throw new PipelineError(
          "PUBLIC_DEPLOYMENT_HASH_INVALID",
          `${asset.assetId}/${publicFile.profile} dHash/pHash drifted`,
        );
      }
    }
  }
}

async function deployNoClobber(approved, receipts, paletteData) {
  const parent = path.dirname(PUBLIC_TARGET);
  await mkdir(parent, { recursive: true });
  const temp = await mkdtemp(path.join(parent, ".tmp-massage-love-heroes-v1-"));
  try {
    const assets = approved.refinement.value.assets.map((asset) => ({
      assetId: asset.assetId,
      sourceSha256: asset.sourceSha256,
      publicFiles: publicFilesForAsset(asset),
    }));
    for (const asset of approved.refinement.value.assets) {
      const destinationDir = path.join(temp, asset.assetId);
      await mkdir(destinationDir, { recursive: true });
      for (const variant of asset.variants) {
        await copyFile(
          path.join(PROJECT_ROOT, variant.path),
          path.join(destinationDir, `${variant.profile}.webp`),
        );
      }
    }
    const deployment = {
      schemaVersion: "massage-love-image-deployment/v1",
      campaignId: "massage-love-image-campaign-v1",
      status: "COMPLETE",
      sourceReceiptPath: path.relative(PROJECT_ROOT, SOURCE_RELEASE_RECEIPT_PATH),
      sourceReceiptSha256: receipts.sourceWritten.sha256,
      refinementReceiptPath: path.relative(PROJECT_ROOT, REFINEMENT_RELEASE_RECEIPT_PATH),
      refinementReceiptSha256: receipts.refinementWritten.sha256,
      paletteManifestPath: path.relative(PROJECT_ROOT, PALETTE_MANIFEST_PATH),
      paletteManifestSha256: paletteData.paletteWritten.sha256,
      headerBindingPath: path.relative(PROJECT_ROOT, HEADER_BINDING_PATH),
      headerBindingSha256: paletteData.bindingWritten.sha256,
      counts: { assets: assets.length, publicFiles: assets.length * PROFILES.length },
      assets,
    };
    const deploymentBytes = Buffer.from(`${JSON.stringify(deployment, null, 2)}\n`);
    await writeFile(path.join(temp, "deployment-manifest.json"), deploymentBytes, {
      flag: "wx",
      mode: 0o600,
    });
    const deploymentSha256 = sha256(deploymentBytes);
    await verifyDeploymentTree(temp, deployment, deploymentSha256);
    try {
      const targetMetadata = await lstat(PUBLIC_TARGET);
      if (!targetMetadata.isDirectory() || targetMetadata.isSymbolicLink()) {
        throw new PipelineError(
          "PUBLIC_TARGET_INVALID",
          "existing public release target must be a real directory",
        );
      }
      const existing = await readJsonFile(path.join(PUBLIC_TARGET, "deployment-manifest.json"));
      if (existing.sha256 !== deploymentSha256) {
        throw new PipelineError(
          "PUBLIC_NO_CLOBBER_CONFLICT",
          "public image release v1 already exists with different evidence",
        );
      }
      await verifyDeploymentTree(PUBLIC_TARGET, deployment, deploymentSha256);
      await rm(temp, { recursive: true, force: true });
      return { deployment, deploymentSha256: existing.sha256, reused: true };
    } catch (error) {
      if (error instanceof PipelineError) throw error;
      if (error?.code !== "ENOENT") throw error;
    }
    await rename(temp, PUBLIC_TARGET);
    await verifyDeploymentTree(PUBLIC_TARGET, deployment, deploymentSha256);
    return { deployment, deploymentSha256, reused: false };
  } catch (error) {
    await rm(temp, { recursive: true, force: true });
    throw error;
  }
}

export async function promoteApprovedRelease() {
  const [contracts, approved] = await Promise.all([
    loadAndValidateContracts(),
    loadApprovedRefinement(),
  ]);
  const receipts = await buildReleaseReceipts(approved);
  const paletteData = await buildPalettesAndBindings(contracts, approved);
  const deployed = await deployNoClobber(approved, receipts, paletteData);
  const publicReceiptPath = `public/${DEPLOYMENT_MANIFEST_RELATIVE}`;
  const assetById = new Map(
    approved.refinement.value.assets.map((asset) => [asset.assetId, asset]),
  );
  const toGovernanceAsset = (assetId) => {
    const asset = assetById.get(assetId);
    return {
      assetId,
      sourceSha256: asset.sourceSha256,
      publicFiles: governancePublicFilesForAsset(asset),
      supplementalPHashes: publicFilesForAsset(asset).map((file) => ({
        profile: file.profile,
        algorithm: file.pHashAlgorithm,
        value: file.pHash,
      })),
      sourceReceiptPath: path.relative(PROJECT_ROOT, SOURCE_RELEASE_RECEIPT_PATH),
      sourceReceiptSha256: receipts.sourceWritten.sha256,
      refinementReceiptPath: path.relative(PROJECT_ROOT, REFINEMENT_RELEASE_RECEIPT_PATH),
      refinementReceiptSha256: receipts.refinementWritten.sha256,
      publicReceiptPath,
      publicReceiptSha256: deployed.deploymentSha256,
    };
  };
  const images = {
    status: "COMPLETE",
    home: {
      ...toGovernanceAsset("MLV-HOME-001"),
      route: "/",
      references: 0,
      referencePolicy: "truthful-text-only-plan",
    },
    regionalAssets: contracts.campaign.regionalImages.map((image) =>
      toGovernanceAsset(image.imageId),
    ),
    assignments: paletteData.bindingManifest.assignments,
  };
  const release = {
    schemaVersion: "massage-love-image-release/v1",
    platformId: "massage-love",
    status: "COMPLETE",
    governanceCompatibility: {
      contentPolicy: "PASS_ELIGIBLE",
      fullImagePolicy: "BLOCKED_HOME_REFERENCE_POLICY_CONFLICT",
      reason:
        "The immutable, truthful Massage Love plan is text-only with zero references, while shared full-image policy currently requires one homepage reference. Do not falsify references.",
    },
    deploymentManifestPath: publicReceiptPath,
    deploymentManifestSha256: deployed.deploymentSha256,
    paletteManifestPath: path.relative(PROJECT_ROOT, PALETTE_MANIFEST_PATH),
    paletteManifestSha256: paletteData.paletteWritten.sha256,
    headerBindingPath: path.relative(PROJECT_ROOT, HEADER_BINDING_PATH),
    headerBindingSha256: paletteData.bindingWritten.sha256,
    images,
  };
  await atomicNoClobberJson(IMAGE_RELEASE_PATH, release);
  const variantsByAsset = new Map(
    approved.refinement.value.assets.map((asset) => [
      asset.assetId,
      Object.fromEntries(
        publicFilesForAsset(asset).map((file) => [file.profile, file.publicPath]),
      ),
    ]),
  );
  const runtime = {
    schemaVersion: "massage-love-runtime-image-release/v1",
    status: "COMPLETE",
    home: {
      assetId: "MLV-HOME-001",
      paths: variantsByAsset.get("MLV-HOME-001"),
      palette: paletteData.bindingManifest.home.palette,
      headerBinding: paletteData.bindingManifest.home.headerBinding,
    },
    routes: Object.fromEntries(
      paletteData.bindingManifest.assignments.map((assignment) => [
        assignment.route,
        {
          assetId: assignment.assetId,
          paths: variantsByAsset.get(assignment.assetId),
          palette: assignment.palette,
          headerBinding: assignment.headerBinding,
        },
      ]),
    ),
  };
  const currentRuntime = (await readJsonFile(RUNTIME_RELEASE_PATH)).value;
  if (currentRuntime.status === "COMPLETE") {
    if (canonicalSha256(currentRuntime) !== canonicalSha256(runtime)) {
      throw new PipelineError(
        "RUNTIME_RELEASE_NO_CLOBBER_CONFLICT",
        "runtime release is already complete with different bindings",
      );
    }
  } else if (currentRuntime.status === "PENDING_NO_ASSETS") {
    await atomicReplaceJson(RUNTIME_RELEASE_PATH, runtime);
  } else {
    throw new PipelineError("RUNTIME_RELEASE_STATE_INVALID", "runtime release state is invalid");
  }
  return release;
}

function reviewArgs(argv) {
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

async function status() {
  const files = [
    REFINEMENT_MANIFEST_PATH,
    REFINED_MACHINE_REPORT_PATH,
    REFINED_CONTACT_MANIFEST_PATH,
    REFINED_REVIEW_PATH,
    SOURCE_RELEASE_RECEIPT_PATH,
    REFINEMENT_RELEASE_RECEIPT_PATH,
    PALETTE_MANIFEST_PATH,
    HEADER_BINDING_PATH,
    IMAGE_RELEASE_PATH,
  ];
  const records = [];
  for (const filePath of files) {
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
  if (command === "refine") {
    const result = await refineApprovedSources();
    process.stdout.write(`${JSON.stringify({ status: result.status, counts: result.counts })}\n`);
    return;
  }
  if (command === "machine-qa") {
    const result = await runRefinedMachineQa();
    process.stdout.write(`${JSON.stringify({ status: result.status, counts: result.counts })}\n`);
    return;
  }
  if (command === "contact-sheets") {
    const result = await buildRefinedContactSheets();
    process.stdout.write(`${JSON.stringify({ status: result.status, counts: result.counts })}\n`);
    return;
  }
  if (command === "record-review") {
    const result = await recordRefinedHumanReview(reviewArgs(rest));
    process.stdout.write(`${JSON.stringify({ status: result.status, counts: result.counts })}\n`);
    return;
  }
  if (command === "promote") {
    const result = await promoteApprovedRelease();
    process.stdout.write(`${JSON.stringify({ status: result.status, images: result.images.status })}\n`);
    return;
  }
  if (command === "status") return status();
  throw new PipelineError("COMMAND_INVALID", `unknown refine/release command: ${command}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(
      `${JSON.stringify({ code: error?.code ?? "UNKNOWN", message: error?.message ?? String(error), details: error?.details ?? null })}\n`,
    );
    process.exitCode = 1;
  });
}
