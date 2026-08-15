import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type CorpusRoute = {
  route: string;
};

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifactRoot = path.join(projectRoot, "artifacts");
const outRoot = path.join(projectRoot, "out");

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function builtHtmlPath(route: string): string {
  if (route === "/") return path.join(outRoot, "index.html");
  const decoded = decodeURIComponent(route).replace(/^\/+|\/+$/gu, "");
  return path.join(outRoot, decoded, "index.html");
}

async function main() {
  const [corpusBytes, semanticReceiptBytes] = await Promise.all([
    readFile(path.join(artifactRoot, "content-corpus.json")),
    readFile(path.join(artifactRoot, "built-visible-contract-receipt.v1.json")),
  ]);
  const corpus = JSON.parse(corpusBytes.toString("utf8")) as {
    status?: string;
    routeVisibleContracts?: CorpusRoute[];
  };
  const semanticReceipt = JSON.parse(semanticReceiptBytes.toString("utf8")) as {
    schemaVersion?: string;
    status?: string;
    counts?: { semanticCaseSetSha256?: string };
  };
  if (
    corpus.status !== "COMPLETE" ||
    !Array.isArray(corpus.routeVisibleContracts) ||
    semanticReceipt.status !== "PASS" ||
    semanticReceipt.schemaVersion !==
      "massage-love-built-visible-semantic-contract-receipt/v4"
  ) {
    throw new Error("MASSAGE_LOVE_NON_RELEASE_RAW_DIAGNOSTIC_INPUT_INVALID");
  }

  const cases = await Promise.all(
    corpus.routeVisibleContracts.map(async ({ route }) => {
      const htmlPath = builtHtmlPath(route);
      const htmlBytes = await readFile(htmlPath);
      return {
        route,
        htmlPath: path.relative(projectRoot, htmlPath),
        rawHtmlSha256: sha256(htmlBytes),
      };
    }),
  );
  const diagnostic = {
    schemaVersion: "massage-love-built-visible-raw-html-diagnostic/v2",
    status: "NON_RELEASE_DIAGNOSTIC",
    releaseAuthority: false,
    semanticContext: {
      receiptPath: "artifacts/built-visible-contract-receipt.v1.json",
      receiptSha256: sha256(semanticReceiptBytes),
      semanticCaseSetSha256: semanticReceipt.counts?.semanticCaseSetSha256,
    },
    policy: {
      command: "pnpm qa:raw:diagnostic",
      allowedToBeAbsentInvalidArbitraryOrDeleted: true,
      prohibitedFromReleaseConsumers: true,
    },
    rawHtmlAggregateSha256: sha256(
      cases.map((entry) => `${entry.route}\0${entry.rawHtmlSha256}`).join("\n"),
    ),
    cases,
  };
  const contents = `${JSON.stringify(diagnostic, null, 2)}\n`;
  await writeFile(
    path.join(artifactRoot, "built-visible-raw-html-diagnostic.v1.json"),
    contents,
    "utf8",
  );
  process.stdout.write(
    `${JSON.stringify({
      status: diagnostic.status,
      routes: cases.length,
      diagnosticSha256: sha256(contents),
    })}\n`,
  );
}

await main();
