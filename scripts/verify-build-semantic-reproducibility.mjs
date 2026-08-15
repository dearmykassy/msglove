import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifactRoot = path.join(projectRoot, "artifacts");
const semanticReceiptRelative = "artifacts/built-visible-contract-receipt.v1.json";
const copyEntries = [
  "src",
  "scripts",
  "public",
  "pipeline",
  ".env.example",
  "eslint.config.mjs",
  "next-env.d.ts",
  "next.config.ts",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "tsconfig.json",
  "vitest.config.mts",
];

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function copyProject(destination) {
  await mkdir(destination, { recursive: true });
  for (const relativePath of copyEntries) {
    await cp(path.join(projectRoot, relativePath), path.join(destination, relativePath), {
      recursive: true,
    });
  }
  // Turbopack rejects a node_modules symlink that points outside the copied
  // project root. BSD cp preserves pnpm's relative symlinks verbatim, while
  // APFS clone-on-write keeps this local dependency tree fast and isolated.
  await runCommand(
    "/bin/cp",
    [
      "-R",
      "-c",
      "-P",
      path.join(projectRoot, "node_modules"),
      path.join(destination, "node_modules"),
    ],
    destination,
    "MASSAGE_LOVE_REPRO_DEPENDENCY_CLONE_FAILED",
  );
}

function runCommand(command, args, cwd, errorCode) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
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
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(
          new Error(
            `${errorCode}:${code}\n${stdout.slice(-4000)}\n${stderr.slice(-4000)}`,
          ),
        );
      }
    });
  });
}

function runBuild(cwd) {
  return runCommand("pnpm", ["build"], cwd, "MASSAGE_LOVE_REPRO_BUILD_FAILED");
}

async function cleanBuildOutputs(cwd) {
  await Promise.all([
    rm(path.join(cwd, ".next"), { recursive: true, force: true }),
    rm(path.join(cwd, "out"), { recursive: true, force: true }),
    rm(path.join(cwd, "artifacts"), { recursive: true, force: true }),
  ]);
}

async function captureBuild(label, physicalPathGroup, cwd) {
  await runBuild(cwd);
  const semanticBytes = await readFile(path.join(cwd, semanticReceiptRelative));
  const semantic = JSON.parse(semanticBytes.toString("utf8"));
  if (
    semantic.status !== "PASS" ||
    semantic.schemaVersion !== "massage-love-built-visible-semantic-contract-receipt/v4"
  ) {
    throw new Error(`MASSAGE_LOVE_REPRO_BUILD_RECEIPT_INVALID:${label}`);
  }
  return {
    label,
    physicalPathGroup,
    normativeSemanticReceiptSha256: sha256(semanticBytes),
    semanticCaseSetSha256: semantic.counts.semanticCaseSetSha256,
    corpusSha256: semantic.corpus.sha256,
    sourceManifestSha256: semantic.corpus.sourceManifestSha256,
    routes: semantic.counts.routes,
  };
}

async function main() {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "massage-love-semantic-repro-"));
  const samePath = path.join(temporaryRoot, "physical-path-a");
  const differentPath = path.join(temporaryRoot, "physical-path-b");
  try {
    await Promise.all([copyProject(samePath), copyProject(differentPath)]);
    const buildA1 = await captureBuild("same-path-clean-build-1", "A", samePath);
    await cleanBuildOutputs(samePath);
    const buildA2 = await captureBuild("same-path-clean-build-2", "A", samePath);
    const buildB1 = await captureBuild("different-path-clean-build-1", "B", differentPath);
    const builds = [buildA1, buildA2, buildB1];
    const normativeReceiptShas = new Set(
      builds.map((entry) => entry.normativeSemanticReceiptSha256),
    );
    const semanticCaseSetShas = new Set(builds.map((entry) => entry.semanticCaseSetSha256));
    const corpusShas = new Set(builds.map((entry) => entry.corpusSha256));
    const sourceManifestShas = new Set(builds.map((entry) => entry.sourceManifestSha256));
    const status =
      normativeReceiptShas.size === 1 &&
      semanticCaseSetShas.size === 1 &&
      corpusShas.size === 1 &&
      sourceManifestShas.size === 1 &&
      builds.every((entry) => entry.routes === 1298)
        ? "PASS"
        : "FAIL";
    const receipt = {
      schemaVersion: "massage-love-required-semantic-build-set/v2",
      status,
      policy: {
        minimumCleanBuilds: 3,
        samePhysicalPathBuilds: 2,
        differentPhysicalPathBuilds: 1,
        normativeRequirement:
          "semantic receipt bytes, semantic case-set digest, corpus, and source manifest must be identical",
      },
      assertions: {
        builds: builds.length,
        physicalPathGroups: new Set(builds.map((entry) => entry.physicalPathGroup)).size,
        uniqueNormativeSemanticReceiptShas: normativeReceiptShas.size,
        uniqueSemanticCaseSetShas: semanticCaseSetShas.size,
        uniqueCorpusShas: corpusShas.size,
        uniqueSourceManifestShas: sourceManifestShas.size,
      },
      builds,
    };
    await mkdir(artifactRoot, { recursive: true });
    const contents = `${JSON.stringify(receipt, null, 2)}\n`;
    await writeFile(
      path.join(artifactRoot, "build-semantic-reproducibility-receipt.v1.json"),
      contents,
      "utf8",
    );
    if (status !== "PASS") {
      throw new Error(`MASSAGE_LOVE_SEMANTIC_REPRODUCIBILITY_FAILED:${contents}`);
    }
    process.stdout.write(
      `${JSON.stringify({
        status,
        builds: builds.length,
        physicalPathGroups: receipt.assertions.physicalPathGroups,
        normativeSemanticReceiptSha256: builds[0].normativeSemanticReceiptSha256,
        receiptSha256: sha256(contents),
      })}\n`,
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

await main();
