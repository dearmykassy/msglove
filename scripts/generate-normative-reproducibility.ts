import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  LOVE_V9_NORMATIVE_CHAIN,
  buildNormativeReproducibilitySummary,
  buildSemanticReleaseLock,
  validateNormativeReproducibilitySummary,
  validateSemanticReleaseLock,
} from "./normative-reproducibility-schema";

type RequiredBuild = {
  label: string;
  physicalPathGroup: string;
  normativeSemanticReceiptSha256: string;
  semanticCaseSetSha256: string;
  corpusSha256: string;
  sourceManifestSha256: string;
  routes: number;
};

type RequiredReceipt = {
  schemaVersion: string;
  status: string;
  assertions: {
    builds: number;
    physicalPathGroups: number;
    uniqueNormativeSemanticReceiptShas: number;
    uniqueSemanticCaseSetShas: number;
    uniqueCorpusShas: number;
    uniqueSourceManifestShas: number;
  };
  builds: RequiredBuild[];
};

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifactRoot = path.join(projectRoot, "artifacts");
const legacyScript = path.join(
  projectRoot,
  "scripts/verify-build-semantic-reproducibility.mjs",
);
const summaryPath = path.join(
  artifactRoot,
  "build-semantic-reproducibility-receipt.v1.json",
);
const lockPath = path.join(
  artifactRoot,
  "built-visible-semantic-release-lock.v1.json",
);

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function stableJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function runLegacyReproducibility(): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [legacyScript], {
      cwd: projectRoot,
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else {
        reject(
          new Error(
            `MASSAGE_LOVE_LEGACY_REPRO_RUN_FAILED:${code}\n${stdout.slice(-4000)}\n${stderr.slice(-4000)}`,
          ),
        );
      }
    });
  });
}

function assertRequiredRun(receipt: RequiredReceipt, label: string): void {
  if (
    receipt.schemaVersion !== "massage-love-required-semantic-build-set/v2" ||
    receipt.status !== "PASS" ||
    receipt.assertions.builds !== 3 ||
    receipt.assertions.physicalPathGroups !== 2 ||
    receipt.assertions.uniqueNormativeSemanticReceiptShas !== 1 ||
    receipt.assertions.uniqueSemanticCaseSetShas !== 1 ||
    receipt.assertions.uniqueCorpusShas !== 1 ||
    receipt.assertions.uniqueSourceManifestShas !== 1 ||
    receipt.builds.length !== 3
  ) {
    throw new Error(`MASSAGE_LOVE_REQUIRED_REPRO_TOPOLOGY_FAILED:${label}`);
  }
  const samePathBuilds = receipt.builds.filter(
    (entry) => entry.physicalPathGroup === "A",
  ).length;
  const differentPathBuilds = receipt.builds.filter(
    (entry) => entry.physicalPathGroup === "B",
  ).length;
  if (samePathBuilds !== 2 || differentPathBuilds !== 1) {
    throw new Error(`MASSAGE_LOVE_REQUIRED_PATH_GROUP_COUNTS_FAILED:${label}`);
  }
  for (const entry of receipt.builds) {
    if (
      entry.normativeSemanticReceiptSha256 !==
        LOVE_V9_NORMATIVE_CHAIN.semanticReceiptSha256 ||
      entry.semanticCaseSetSha256 !== LOVE_V9_NORMATIVE_CHAIN.semanticCaseSetSha256 ||
      entry.corpusSha256 !== LOVE_V9_NORMATIVE_CHAIN.corpusSha256 ||
      entry.sourceManifestSha256 !== LOVE_V9_NORMATIVE_CHAIN.sourceManifestSha256 ||
      entry.routes !== LOVE_V9_NORMATIVE_CHAIN.routes
    ) {
      throw new Error(`MASSAGE_LOVE_NORMATIVE_CHAIN_DRIFT:${label}:${entry.label}`);
    }
  }
}

async function readRequiredReceipt(): Promise<RequiredReceipt> {
  return JSON.parse(await readFile(summaryPath, "utf8")) as RequiredReceipt;
}

async function main() {
  const semanticReceiptBytes = await readFile(
    path.join(artifactRoot, "built-visible-contract-receipt.v1.json"),
  );
  if (sha256(semanticReceiptBytes) !== LOVE_V9_NORMATIVE_CHAIN.semanticReceiptSha256) {
    throw new Error("MASSAGE_LOVE_CURRENT_SEMANTIC_RECEIPT_NOT_V9_CHAIN");
  }

  await runLegacyReproducibility();
  const firstRun = await readRequiredReceipt();
  assertRequiredRun(firstRun, "fresh-run-1");
  const firstSummaryContents = stableJson(buildNormativeReproducibilitySummary());
  const firstSummarySha256 = sha256(firstSummaryContents);
  const firstLock = buildSemanticReleaseLock(firstSummarySha256);
  validateNormativeReproducibilitySummary(JSON.parse(firstSummaryContents));
  validateSemanticReleaseLock(firstLock, firstSummarySha256);
  const firstLockContents = stableJson(firstLock);

  // A second independent required set proves the normative summary and lock
  // remain byte-identical across six clean builds.
  await runLegacyReproducibility();
  const secondRun = await readRequiredReceipt();
  assertRequiredRun(secondRun, "fresh-run-2");
  const secondSummaryContents = stableJson(buildNormativeReproducibilitySummary());
  const secondSummarySha256 = sha256(secondSummaryContents);
  const secondLock = buildSemanticReleaseLock(secondSummarySha256);
  validateNormativeReproducibilitySummary(JSON.parse(secondSummaryContents));
  validateSemanticReleaseLock(secondLock, secondSummarySha256);
  const secondLockContents = stableJson(secondLock);
  if (
    firstSummaryContents !== secondSummaryContents ||
    firstLockContents !== secondLockContents
  ) {
    throw new Error("MASSAGE_LOVE_NORMATIVE_REPRO_CHAIN_NOT_BYTE_IDENTICAL");
  }

  await Promise.all([
    writeFile(summaryPath, secondSummaryContents, "utf8"),
    writeFile(lockPath, secondLockContents, "utf8"),
  ]);
  process.stdout.write(
    `${JSON.stringify({
      status: "PASS",
      normativeSummarySha256: secondSummarySha256,
      semanticReceiptSha256: LOVE_V9_NORMATIVE_CHAIN.semanticReceiptSha256,
      releaseLockSha256: sha256(secondLockContents),
      freshRuns: 2,
      cleanBuildExecutions: 6,
    })}\n`,
  );
}

await main();
