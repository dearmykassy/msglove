import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseNonReleaseRawObservation,
  readNonReleaseRawObservation,
} from "../scripts/non-release-raw-observation";
import {
  validateNormativeReproducibilitySummary,
  validateSemanticReleaseLock,
} from "../scripts/normative-reproducibility-schema";

const artifactRoot = path.resolve(process.cwd(), "artifacts");
const summaryBytes = readFileSync(
  path.join(artifactRoot, "build-semantic-reproducibility-receipt.v1.json"),
);
const summary = JSON.parse(summaryBytes.toString("utf8"));
const lock = JSON.parse(
  readFileSync(
    path.join(artifactRoot, "built-visible-semantic-release-lock.v1.json"),
    "utf8",
  ),
);
const releaseConsumerSources = [
  "scripts/verify-built-visible-contract.ts",
  "scripts/verify-build-semantic-reproducibility.mjs",
  "scripts/generate-normative-reproducibility.ts",
].map((relativePath) => ({
  relativePath,
  source: readFileSync(path.resolve(process.cwd(), relativePath), "utf8"),
}));
const packageJson = JSON.parse(
  readFileSync(path.resolve(process.cwd(), "package.json"), "utf8"),
);

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function validateAuthorityWithoutDiagnostics(): string {
  const summarySha256 = sha256(summaryBytes);
  validateNormativeReproducibilitySummary(summary);
  validateSemanticReleaseLock(lock, summarySha256);
  return sha256(`${JSON.stringify(summary)}\0${JSON.stringify(lock)}`);
}

describe("non-release raw diagnostics", () => {
  it("keeps release consumers free of diagnostic file dependencies", () => {
    for (const consumer of releaseConsumerSources) {
      expect(consumer.source, consumer.relativePath).not.toMatch(
        /built-visible-raw-html|build-raw-html|rawHtml|rawDiagnostic|rawObservation/iu,
      );
    }
    expect(packageJson.scripts.postbuild).toBeUndefined();
    expect(packageJson.scripts.build).toContain("pnpm verify:built");
    expect(packageJson.scripts.build).not.toContain("qa:raw:diagnostic");
    expect(packageJson.scripts["qa:build:repro"]).not.toContain("qa:raw:diagnostic");
    expect(packageJson.scripts["qa:raw:diagnostic"]).toBe(
      "tsx scripts/generate-built-raw-html-diagnostic.ts",
    );
  });

  it("leaves authority unchanged for arbitrary bytes and valid diagnostic mutations", () => {
    const authorityBefore = validateAuthorityWithoutDiagnostics();
    expect(parseNonReleaseRawObservation("not-json")).toEqual({
      status: "DIAGNOSTIC_UNAVAILABLE",
    });
    expect(
      parseNonReleaseRawObservation(
        JSON.stringify({
          releaseAuthority: false,
          arbitraryValues: ["changed", 999, null],
          arbitraryCount: 999,
        }),
      ).status,
    ).toBe("DIAGNOSTIC_AVAILABLE");
    expect(validateAuthorityWithoutDiagnostics()).toBe(authorityBefore);
  });

  it("keeps authority stable through diagnostic file mutation and deletion", async () => {
    const authorityBefore = validateAuthorityWithoutDiagnostics();
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), "love-raw-diagnostic-test-"));
    const diagnosticPath = path.join(temporaryRoot, "observation.json");
    try {
      await writeFile(diagnosticPath, "arbitrary-non-json-bytes", "utf8");
      expect(await readNonReleaseRawObservation(diagnosticPath)).toEqual({
        status: "DIAGNOSTIC_UNAVAILABLE",
      });
      expect(validateAuthorityWithoutDiagnostics()).toBe(authorityBefore);

      await writeFile(
        diagnosticPath,
        JSON.stringify({ releaseAuthority: false, changedCount: 1000000 }),
        "utf8",
      );
      expect((await readNonReleaseRawObservation(diagnosticPath)).status).toBe(
        "DIAGNOSTIC_AVAILABLE",
      );
      expect(validateAuthorityWithoutDiagnostics()).toBe(authorityBefore);

      await rm(diagnosticPath);
      expect(await readNonReleaseRawObservation(diagnosticPath)).toEqual({
        status: "DIAGNOSTIC_UNAVAILABLE",
      });
      expect(validateAuthorityWithoutDiagnostics()).toBe(authorityBefore);
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  });
});
