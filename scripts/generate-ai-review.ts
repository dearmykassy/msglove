import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildAiReviewReceipt,
  validateAiReviewReceipt,
} from "./ai-review-contract";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

async function load(relativePath: string) {
  const bytes = await readFile(path.join(projectRoot, relativePath));
  return {
    path: relativePath,
    bytes,
    sha256: sha256(bytes),
    value: JSON.parse(bytes.toString("utf8")) as Record<string, unknown>,
  };
}

async function main() {
  const [corpus, quality, semantic, decisionSource] = await Promise.all([
    load("artifacts/content-corpus.json"),
    load("artifacts/content-quality-receipt.json"),
    load("artifacts/built-visible-contract-receipt.v1.json"),
    load("artifacts/content-ai-review-decisions.v1.json"),
  ]);
  if (
    corpus.value.status !== "COMPLETE" ||
    quality.value.status !== "PASS" ||
    !Array.isArray(quality.value.violations) ||
    quality.value.violations.length !== 0 ||
    semantic.value.status !== "PASS"
  ) {
    throw new Error("MASSAGE_LOVE_AI_REVIEW_INPUT_NOT_PASS");
  }
  const inputs = {
    corpus: corpus.value,
    corpusSha256: corpus.sha256,
    qualityReceiptSha256: quality.sha256,
    semanticReceipt: semantic.value,
    semanticReceiptSha256: semantic.sha256,
  };
  const receipt = buildAiReviewReceipt(
    decisionSource.value,
    decisionSource.sha256,
    inputs,
  );
  validateAiReviewReceipt(
    receipt,
    decisionSource.value,
    decisionSource.sha256,
    inputs,
  );
  const contents = `${JSON.stringify(receipt, null, 2)}\n`;
  await writeFile(
    path.join(projectRoot, "artifacts/content-ai-review.v1.json"),
    contents,
    "utf8",
  );
  process.stdout.write(
    `${JSON.stringify({
      status: receipt.status,
      candidates: receipt.decisions.required,
      approved: receipt.decisions.approved,
      receiptSha256: sha256(contents),
    })}\n`,
  );
}

await main();
