#!/usr/bin/env node

import path from "node:path";
import {
  GENERATION_MANIFEST_PATH,
  HEADER_BINDING_PATH,
  IMAGE_RELEASE_PATH,
  PALETTE_MANIFEST_PATH,
  PROJECT_ROOT,
  REFINED_CONTACT_MANIFEST_PATH,
  REFINED_MACHINE_REPORT_PATH,
  REFINED_REVIEW_PATH,
  REFINEMENT_MANIFEST_PATH,
  SOURCE_CONTACT_MANIFEST_PATH,
  SOURCE_MACHINE_REPORT_PATH,
  SOURCE_REVIEW_PATH,
  fileExists,
  loadAndValidateContracts,
  readJsonFile,
  validateGenerationManifest,
} from "./lib.mjs";

const contracts = await loadAndValidateContracts();
const generationFile = await readJsonFile(GENERATION_MANIFEST_PATH);
const generation = validateGenerationManifest(contracts, generationFile.value);
const stages = [
  ["generation", GENERATION_MANIFEST_PATH],
  ["sourceMachineQa", SOURCE_MACHINE_REPORT_PATH],
  ["sourceContactSheets", SOURCE_CONTACT_MANIFEST_PATH],
  ["sourceHumanReview", SOURCE_REVIEW_PATH],
  ["refinement", REFINEMENT_MANIFEST_PATH],
  ["refinedMachineQa", REFINED_MACHINE_REPORT_PATH],
  ["refinedContactSheets", REFINED_CONTACT_MANIFEST_PATH],
  ["refinedHumanReview", REFINED_REVIEW_PATH],
  ["palette", PALETTE_MANIFEST_PATH],
  ["headerBindings", HEADER_BINDING_PATH],
  ["release", IMAGE_RELEASE_PATH],
];
const records = [];
for (const [stage, filePath] of stages) {
  if (!(await fileExists(filePath))) {
    records.push({ stage, path: path.relative(PROJECT_ROOT, filePath), exists: false });
    continue;
  }
  const file = await readJsonFile(filePath);
  records.push({
    stage,
    path: path.relative(PROJECT_ROOT, filePath),
    exists: true,
    sha256: file.sha256,
    status: file.value.status,
    counts: file.value.counts,
  });
}
const blockers = [];
if (generation.counts.completed !== 324) blockers.push(`sources:${generation.counts.completed}/324`);
for (const [stage] of stages.slice(1, 8)) {
  const record = records.find((item) => item.stage === stage);
  if (!record?.exists || !["PASS", "READY_FOR_HUMAN_REVIEW", "REFINED_AWAITING_MACHINE_AND_HUMAN_QA"].includes(record.status)) {
    blockers.push(stage);
  }
}
if (!(await fileExists(IMAGE_RELEASE_PATH))) blockers.push("atomicPublicPromotion");
blockers.push("sharedFullGovernance:homeReferencesPolicyRequires1ButTruthfulPlanIs0");
process.stdout.write(
  `${JSON.stringify({
    schemaVersion: "massage-love-image-pipeline-status/v1",
    status: blockers.length ? "BLOCKED_EXPECTED" : "READY",
    metaCallsThisCommand: 0,
    planFileSha256: contracts.planFileSha256,
    campaignFileSha256: contracts.campaignFileSha256,
    records,
    blockers,
  }, null, 2)}\n`,
);
