import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifactRoot = path.join(projectRoot, "artifacts");

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
  const [corpus, built] = await Promise.all([
    load("artifacts/content-corpus.json"),
    load("artifacts/built-visible-contract-receipt.v1.json"),
  ]);
  if (
    corpus.value.status !== "COMPLETE" ||
    built.value.status !== "PASS" ||
    built.value.schemaVersion !==
      "massage-love-built-visible-semantic-contract-receipt/v4" ||
    (built.value.corpus as Record<string, unknown> | undefined)?.sha256 !==
      corpus.sha256
  ) {
    throw new Error("MASSAGE_LOVE_BROWSER_PENDING_SOURCE_BINDING_INVALID");
  }
  const receipt = {
    schemaVersion: "massage-love-browser-qa/v6",
    status: "PENDING_IAB",
    releaseAuthority: false,
    policy: {
      requiredSurface: "Codex in-app browser through browser-client",
      chromeExtensionAccepted: false,
      playwrightCliAccepted: false,
      computerUseAccepted: false,
      staleScreenshotReuseAccepted: false,
    },
    source: {
      corpus: { path: corpus.path, sha256: corpus.sha256 },
      builtVisibleSemanticContract: {
        path: built.path,
        sha256: built.sha256,
        semanticCaseSetSha256: (built.value.counts as Record<string, unknown>)
          .semanticCaseSetSha256,
      },
    },
    pendingReason:
      "The required in-app browser surface was unavailable for a fresh capture; no substitute browser evidence was accepted.",
    assertions: null,
    screenshotCases: [],
  };
  const contents = `${JSON.stringify(receipt, null, 2)}\n`;
  await writeFile(
    path.join(artifactRoot, "browser-qa-receipt.v1.json"),
    contents,
    "utf8",
  );
  process.stdout.write(
    `${JSON.stringify({ status: receipt.status, receiptSha256: sha256(contents) })}\n`,
  );
}

await main();
