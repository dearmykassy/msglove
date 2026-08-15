import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildContentQualityReceipt } from "../src/lib/content-quality";
import { buildSourceRouteVisibleContracts } from "../src/lib/rendered-route-contract";
import {
  buildCompactContentCorpus,
  sha256,
} from "./content-corpus-projection";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifactRoot = path.join(projectRoot, "artifacts");
const protectedImageArtifacts = [
  "image-campaign-contract.json",
  "image-generation-plan.json",
] as const;

function json(value: unknown): string {
  // Generated data is intentionally compact: this is a machine artifact, not
  // a human-authored document, and must not re-expand the 1,291-route corpus.
  return `${JSON.stringify(value)}\n`;
}

async function readProtectedImageArtifacts() {
  return Promise.all(
    protectedImageArtifacts.map(async (filename) => ({
      filename,
      bytes: await readFile(path.join(artifactRoot, filename)),
    })),
  );
}

async function assertProtectedImageArtifactsUnchanged(
  before: Awaited<ReturnType<typeof readProtectedImageArtifacts>>,
) {
  for (const protectedArtifact of before) {
    const after = await readFile(path.join(artifactRoot, protectedArtifact.filename));
    if (!after.equals(protectedArtifact.bytes)) {
      throw new Error(`MASSAGE_LOVE_IMAGE_ARTIFACT_MUTATED:${protectedArtifact.filename}`);
    }
  }
}

async function main() {
  await mkdir(artifactRoot, { recursive: true });
  const imageArtifactsBefore = await readProtectedImageArtifacts();
  const sourceContracts = buildSourceRouteVisibleContracts();
  const corpus = await buildCompactContentCorpus(sourceContracts);
  const quality = buildContentQualityReceipt(sourceContracts);
  if (quality.status !== "PASS") {
    throw new Error(`MASSAGE_LOVE_CONTENT_QUALITY_FAILED:${JSON.stringify(quality.violations)}`);
  }

  const contentFiles = {
    "content-corpus.json": json(corpus),
    "content-quality-receipt.json": json(quality),
  };
  for (const [filename, contents] of Object.entries(contentFiles)) {
    await writeFile(path.join(artifactRoot, filename), contents, "utf8");
  }

  await assertProtectedImageArtifactsUnchanged(imageArtifactsBefore);
  const receipt = {
    schemaVersion: "massage-love-content-only-artifact-receipt/v1",
    status: "VERIFIED",
    mode: "CONTENT_ONLY_IMAGE_ARTIFACTS_BYTE_UNCHANGED",
    contentFiles: Object.fromEntries(
      Object.entries(contentFiles).map(([filename, contents]) => [
        filename,
        { sha256: sha256(contents), bytes: Buffer.byteLength(contents) },
      ]),
    ),
    protectedImageArtifacts: Object.fromEntries(
      imageArtifactsBefore.map((entry) => [
        entry.filename,
        { sha256: sha256(entry.bytes), bytes: entry.bytes.length },
      ]),
    ),
  };
  await writeFile(
    path.join(artifactRoot, "content-artifact-receipt.json"),
    json(receipt),
    "utf8",
  );
  process.stdout.write(
    `${JSON.stringify({
      routes: corpus.entries.length,
      sourceProjectionSha256: corpus.sourceProjectionSha256,
      corpusBytes: Buffer.byteLength(contentFiles["content-corpus.json"]),
      imageArtifactsByteUnchanged: true,
    })}\n`,
  );
}

await main();
