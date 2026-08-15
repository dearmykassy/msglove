import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { execFile as execFileCallback } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";
import {
  EXPECTED_CAMPAIGN_FILE_SHA256,
  EXPECTED_JOB_COUNT,
  EXPECTED_PLAN_FILE_SHA256,
  GENERATION_MANIFEST_PATH,
  PROVIDER_EMPTY_REFERENCE_DIGEST,
  PROFILES,
  atomicNoClobberJson,
  createInitialGenerationManifest,
  dhash64,
  phash64,
  providerBindingForJob,
  extractTopPalette,
  hammingDhash,
  hammingPHash,
  loadAndValidateContracts,
  readJsonFile,
  validateGenerationManifest,
} from "./lib.mjs";
import {
  runWithClient,
  validateProviderLedgerBindings,
} from "./run-generation.mjs";
import { runSourceMachineQa } from "./source-qa.mjs";
import {
  cropGeometry,
  promoteApprovedRelease,
  validateApprovedSourceCoverage,
  validateRefinementCoverage,
} from "./refine-release.mjs";

const temporaryRoots = [];
const execFile = promisify(execFileCallback);

async function temporaryRoot() {
  const root = await mkdtemp(path.join(tmpdir(), "massage-love-images-"));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function toolResult(value, isError = false) {
  return { structuredContent: value, isError, content: [] };
}

describe("immutable image contracts", () => {
  it("pins the exact 324 jobs, 65 waves, five lanes, and 1,291 assignments", async () => {
    const contracts = await loadAndValidateContracts();
    expect(contracts.planFileSha256).toBe(EXPECTED_PLAN_FILE_SHA256);
    expect(contracts.campaignFileSha256).toBe(EXPECTED_CAMPAIGN_FILE_SHA256);
    expect(contracts.plan.jobs).toHaveLength(324);
    expect(contracts.plan.waves).toHaveLength(65);
    expect(contracts.plan.runtimeLanes).toBe(5);
    expect(contracts.campaign.assignments).toHaveLength(1291);
    expect(contracts.campaign.homeHero.imageId).toBe("MLV-HOME-001");
    expect(contracts.campaign.homeHero.referenceImages).toEqual([]);
    expect(contracts.campaign.regionalImages.some((image) => image.imageId === "MLV-HOME-001")).toBe(false);
    const usage = new Map();
    for (const assignment of contracts.campaign.assignments) {
      usage.set(assignment.imageId, (usage.get(assignment.imageId) ?? 0) + 1);
    }
    expect([...usage.values()].filter((count) => count === 4)).toHaveLength(322);
    expect([...usage.values()].filter((count) => count === 3)).toHaveLength(1);
  });

  it("initializes a zero-submission durable ledger bound to every exact request", async () => {
    const contracts = await loadAndValidateContracts();
    const manifest = createInitialGenerationManifest(contracts);
    expect(manifest.status).toBe("PLANNED_NO_SUBMISSIONS");
    expect(manifest.entries).toHaveLength(EXPECTED_JOB_COUNT);
    expect(manifest.counts.generationSubmissions).toBe(0);
    expect(manifest.runtimePolicy).toMatchObject({
      lanes: 5,
      drainFirst: true,
      maxWaitCallsPerJob: 12,
      noReplacementWhilePending: true,
    });
    expect(() => validateGenerationManifest(contracts, manifest)).not.toThrow();
  });

  it("rejects drift in an immutable prompt binding", async () => {
    const contracts = await loadAndValidateContracts();
    const manifest = createInitialGenerationManifest(contracts);
    manifest.entries[0].promptSha256 = "0".repeat(64);
    expect(() => validateGenerationManifest(contracts, manifest)).toThrowError(
      expect.objectContaining({ code: "GENERATION_ENTRY_BINDING_INVALID" }),
    );
  });

  it("pins Meta's canonical text-only prompt/request/reference binding", async () => {
    const contracts = await loadAndValidateContracts();
    const home = providerBindingForJob(contracts.plan.jobs[0]);
    expect(home).toEqual({
      promptDigest:
        "sha256:12f6e66536e75231faa2befc162ee6852b0353bfce2dd4cfd0020172429e62b7",
      requestDigest:
        "sha256:47f4a825cb490775f806582ca1b87153e8c414fa908b9496a96dd8dfc403f6b1",
      referenceDigest: PROVIDER_EMPTY_REFERENCE_DIGEST,
      referenceCount: 0,
      outputSubdirectory: "massage-love/home-hero/v1/MLV-HOME-001/a1",
    });
    const manifest = createInitialGenerationManifest(contracts);
    expect(manifest.providerBindingPolicy).toEqual({
      schemaVersion: "meta-ai-text-only-request-binding/v1",
      digestPrefix: "sha256:",
      emptyReferenceDigest: PROVIDER_EMPTY_REFERENCE_DIGEST,
      referenceCount: 0,
      exactStartResponseRequired: true,
    });
  });
});

describe("durable five-lane reconciliation", () => {
  it("drains an existing provider job before any session or start call", async () => {
    const contracts = await loadAndValidateContracts();
    const root = await temporaryRoot();
    const manifestPath = path.join(root, "manifest.json");
    const outputRoot = path.join(root, "outputs");
    const manifest = createInitialGenerationManifest(contracts);
    const entry = manifest.entries[0];
    entry.status = "generating";
    entry.providerJobId = "provider-job-1";
    entry.providerLaneId = "lane-1";
    entry.startCallCount = 1;
    entry.submissionCommitted = true;
    manifest.counts.generationSubmissions = 1;
    const outputDir = path.join(outputRoot, entry.outputSubdirectory);
    await mkdir(outputDir, { recursive: true });
    const filePath = path.join(outputDir, "source.png");
    const bytes = await sharp({
      create: { width: 2048, height: 1152, channels: 3, background: "#512630" },
    }).png().toBuffer();
    await writeFile(filePath, bytes);
    const calls = [];
    const client = {
      async callTool({ name }) {
        calls.push(name);
        if (name !== "meta_ai_wait_and_download") throw new Error(`unexpected ${name}`);
        return toolResult({
          ok: true,
          status: "completed",
          job_id: entry.providerJobId,
          lane_id: entry.providerLaneId,
          files: [{ path: filePath, sha256: await import("node:crypto").then(({ createHash }) => createHash("sha256").update(bytes).digest("hex")), bytes: bytes.length, mime_type: "image/png" }],
        });
      },
    };
    await runWithClient({
      contracts,
      manifest,
      client,
      outputRoot,
      drainOnly: true,
      manifestPath,
    });
    expect(calls).toEqual(["meta_ai_wait_and_download"]);
    expect(manifest.entries[0].status).toBe("completed");
    expect(manifest.status).toBe("PAUSED_AFTER_DRAIN");
    expect(JSON.parse(await readFile(manifestPath, "utf8")).entries[0].files[0].sha256).toHaveLength(64);
  });

  it("uses at most 12 waits and never starts a replacement for a pending job", async () => {
    const contracts = await loadAndValidateContracts();
    const root = await temporaryRoot();
    const manifest = createInitialGenerationManifest(contracts);
    const entry = manifest.entries[0];
    entry.status = "generating";
    entry.providerJobId = "still-pending-provider-job";
    entry.providerLaneId = "lane-1";
    entry.startCallCount = 1;
    entry.submissionCommitted = true;
    manifest.counts.generationSubmissions = 1;
    const calls = [];
    const client = {
      async callTool({ name }) {
        calls.push(name);
        return toolResult({ ok: true, status: "pending", retry_after_ms: 0 });
      },
    };
    await expect(
      runWithClient({
        contracts,
        manifest,
        client,
        outputRoot: path.join(root, "outputs"),
        drainOnly: true,
        manifestPath: path.join(root, "manifest.json"),
      }),
    ).rejects.toMatchObject({ code: "WAIT_EXHAUSTED" });
    expect(calls).toHaveLength(12);
    expect(new Set(calls)).toEqual(new Set(["meta_ai_wait_and_download"]));
    expect(entry.waitCallCount).toBe(12);
    expect(entry.providerJobId).toBe("still-pending-provider-job");
    expect(entry.files).toEqual([]);
  });

  it("drains known active jobs before blocking on a different uncertain submission", async () => {
    const contracts = await loadAndValidateContracts();
    const root = await temporaryRoot();
    const outputRoot = path.join(root, "outputs");
    const manifest = createInitialGenerationManifest(contracts);
    const uncertain = manifest.entries[0];
    uncertain.status = "submission_uncertain";
    uncertain.startCallCount = 1;
    uncertain.error = { code: "SUBMISSION_OUTCOME_UNKNOWN", message: "transport ended" };

    const active = manifest.entries[1];
    active.status = "generating";
    active.providerJobId = "known-provider-job";
    active.providerLaneId = "lane-2";
    active.startCallCount = 1;
    active.submissionCommitted = true;
    manifest.counts.generationSubmissions = 1;
    const outputDir = path.join(outputRoot, active.outputSubdirectory);
    await mkdir(outputDir, { recursive: true });
    const filePath = path.join(outputDir, "source.png");
    const bytes = await sharp({
      create: { width: 2048, height: 1152, channels: 3, background: "#6b313e" },
    }).png().toBuffer();
    await writeFile(filePath, bytes);
    const sourceSha256 = await import("node:crypto").then(({ createHash }) =>
      createHash("sha256").update(bytes).digest("hex"),
    );
    const calls = [];
    const client = {
      async callTool({ name }) {
        calls.push(name);
        if (name !== "meta_ai_wait_and_download") throw new Error(`unexpected ${name}`);
        return toolResult({
          ok: true,
          status: "completed",
          job_id: active.providerJobId,
          lane_id: active.providerLaneId,
          files: [
            {
              path: filePath,
              sha256: sourceSha256,
              bytes: bytes.length,
              mime_type: "image/png",
            },
          ],
        });
      },
    };
    await expect(
      runWithClient({
        contracts,
        manifest,
        client,
        outputRoot,
        drainOnly: false,
        manifestPath: path.join(root, "manifest.json"),
      }),
    ).rejects.toMatchObject({ code: "SUBMISSION_UNCERTAIN" });
    expect(calls).toEqual(["meta_ai_wait_and_download"]);
    expect(active.status).toBe("completed");
    expect(uncertain.status).toBe("submission_uncertain");
    expect(manifest.status).toBe("BLOCKED_GLOBAL_UNCERTAINTY");
  });

  it("turns an interrupted persisted start into fail-closed uncertainty without a Meta call", async () => {
    const contracts = await loadAndValidateContracts();
    const root = await temporaryRoot();
    const manifest = createInitialGenerationManifest(contracts);
    manifest.entries[0].status = "starting";
    manifest.entries[0].startCallCount = 1;
    const calls = [];
    const client = {
      async callTool({ name }) {
        calls.push(name);
        throw new Error(`unexpected ${name}`);
      },
    };
    await expect(
      runWithClient({
        contracts,
        manifest,
        client,
        outputRoot: path.join(root, "outputs"),
        drainOnly: false,
        manifestPath: path.join(root, "manifest.json"),
      }),
    ).rejects.toMatchObject({ code: "SUBMISSION_UNCERTAIN" });
    expect(calls).toEqual([]);
    expect(manifest.entries[0].status).toBe("submission_uncertain");
    expect(manifest.entries[0].error.code).toBe(
      "INTERRUPTED_START_REQUIRES_RECONCILIATION",
    );
  });

  it.each([
    ["missing request/reference", null, false],
    ["missing prompt/request/reference", null, true],
    ["wrong request/reference", `sha256:${"a".repeat(64)}`, false],
  ])("rejects %s digests before any wait", async (_, badDigest, omitPrompt) => {
    const contracts = await loadAndValidateContracts();
    const root = await temporaryRoot();
    const manifest = createInitialGenerationManifest(contracts);
    let starts = 0;
    const calls = [];
    const client = {
      async callTool({ name, arguments: args }) {
        calls.push(name);
        if (name === "meta_ai_ensure_sessions") {
          return toolResult({
            ok: true,
            status: "authenticated",
            lanes: Array.from({ length: 5 }, (__, index) => ({
              lane_id: `lane-0${index + 1}`,
              status: "ready",
              generation_submissions: 0,
            })),
          });
        }
        if (name === "meta_ai_pool_status") {
          return toolResult({
            configured_lane_count: 5,
            effective_lane_count: 5,
            ready_lane_count: 5,
            global_uncertainty: { blocked: false },
            globally_paused: false,
            downshift_recommended: false,
          });
        }
        if (name === "meta_ai_start_image_generation") {
          const index = starts++;
          const expected = providerBindingForJob(contracts.plan.jobs[index]);
          return toolResult({
            ok: true,
            status: "submitted",
            job_id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
            lane_id: `lane-0${index + 1}`,
            duplicate_request: false,
            ...(omitPrompt ? {} : { prompt_digest: expected.promptDigest }),
            ...(badDigest === null
              ? {}
              : {
                  request_digest: badDigest,
                  reference_digest: badDigest,
                  reference_count: 0,
                }),
          });
        }
        throw new Error(`unexpected ${name} ${args?.client_request_id ?? ""}`);
      },
    };
    await expect(
      runWithClient({
        contracts,
        manifest,
        client,
        outputRoot: path.join(root, "outputs"),
        drainOnly: false,
        manifestPath: path.join(root, "manifest.json"),
      }),
    ).rejects.toMatchObject({ code: "START_PROVIDER_DIGEST_MISMATCH" });
    expect(starts).toBe(5);
    expect(calls).not.toContain("meta_ai_wait_and_download");
    expect(manifest.counts.generationSubmissions).toBe(5);
    expect(manifest.entries.slice(0, 5).every((entry) =>
      entry.status === "submission_uncertain")).toBe(true);
  });

  it("rejects an unexpected duplicate provider request without resending", async () => {
    const contracts = await loadAndValidateContracts();
    const root = await temporaryRoot();
    const manifest = createInitialGenerationManifest(contracts);
    let starts = 0;
    const calls = [];
    const client = {
      async callTool({ name }) {
        calls.push(name);
        if (name === "meta_ai_ensure_sessions") {
          return toolResult({
            ok: true,
            status: "authenticated",
            lanes: Array.from({ length: 5 }, (__, index) => ({
              lane_id: `lane-0${index + 1}`,
              status: "ready",
              generation_submissions: 0,
            })),
          });
        }
        if (name === "meta_ai_pool_status") {
          return toolResult({
            configured_lane_count: 5,
            effective_lane_count: 5,
            ready_lane_count: 5,
            global_uncertainty: { blocked: false },
            globally_paused: false,
            downshift_recommended: false,
          });
        }
        if (name === "meta_ai_start_image_generation") {
          const index = starts++;
          const expected = providerBindingForJob(contracts.plan.jobs[index]);
          return toolResult({
            ok: true,
            status: "submitted",
            job_id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
            lane_id: `lane-0${index + 1}`,
            duplicate_request: true,
            prompt_digest: expected.promptDigest,
            request_digest: expected.requestDigest,
            reference_digest: expected.referenceDigest,
            reference_count: expected.referenceCount,
          });
        }
        throw new Error(`unexpected ${name}`);
      },
    };
    await expect(
      runWithClient({
        contracts,
        manifest,
        client,
        outputRoot: path.join(root, "outputs"),
        drainOnly: false,
        manifestPath: path.join(root, "manifest.json"),
      }),
    ).rejects.toMatchObject({ code: "UNEXPECTED_DUPLICATE_REQUEST" });
    expect(starts).toBe(5);
    expect(calls).not.toContain("meta_ai_wait_and_download");
    expect(manifest.counts.generationSubmissions).toBe(0);
  });

  it("resumes after a completed first wave with fresh zero-count lane pages", async () => {
    const contracts = await loadAndValidateContracts();
    const root = await temporaryRoot();
    const manifest = createInitialGenerationManifest(contracts);
    for (let index = 0; index < 5; index += 1) {
      const entry = manifest.entries[index];
      entry.status = "completed";
      entry.startCallCount = 1;
      entry.providerJobId = `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
      entry.providerLaneId = `lane-0${index + 1}`;
      entry.submissionCommitted = true;
      entry.duplicateRequest = false;
      entry.files = [{ path: `/tmp/${entry.imageId}.webp`, sha256: "c".repeat(64), bytes: 1 }];
    }
    manifest.counts.generationSubmissions = 5;
    const calls = [];
    const client = {
      async callTool({ name }) {
        calls.push(name);
        if (name === "meta_ai_ensure_sessions") {
          return toolResult({
            ok: true,
            status: "authenticated",
            lanes: Array.from({ length: 5 }, (__, index) => ({
              lane_id: `lane-0${index + 1}`,
              status: "ready",
              generation_submissions: 0,
            })),
          });
        }
        if (name === "meta_ai_pool_status") {
          return toolResult({
            configured_lane_count: 5,
            effective_lane_count: 5,
            ready_lane_count: 5,
            global_uncertainty: { blocked: false },
            globally_paused: false,
            downshift_recommended: false,
          });
        }
        if (name === "meta_ai_start_image_generation") {
          throw new Error("intentional transport stop after restart gate");
        }
        throw new Error(`unexpected ${name}`);
      },
    };
    await expect(
      runWithClient({
        contracts,
        manifest,
        client,
        outputRoot: path.join(root, "outputs"),
        drainOnly: false,
        manifestPath: path.join(root, "manifest.json"),
      }),
    ).rejects.toMatchObject({ code: "SUBMISSION_OUTCOME_UNKNOWN" });
    expect(calls[0]).toBe("meta_ai_ensure_sessions");
    expect(calls.filter((name) => name === "meta_ai_start_image_generation")).toHaveLength(5);
  });

  it("rejects a nonzero fresh lane-page submission counter", async () => {
    const contracts = await loadAndValidateContracts();
    const root = await temporaryRoot();
    const manifest = createInitialGenerationManifest(contracts);
    const calls = [];
    const client = {
      async callTool({ name }) {
        calls.push(name);
        if (name !== "meta_ai_ensure_sessions") throw new Error(`unexpected ${name}`);
        return toolResult({
          ok: true,
          status: "authenticated",
          lanes: Array.from({ length: 5 }, (__, index) => ({
            lane_id: `lane-0${index + 1}`,
            status: "ready",
            generation_submissions: index === 0 ? 1 : 0,
          })),
        });
      },
    };
    await expect(
      runWithClient({
        contracts,
        manifest,
        client,
        outputRoot: path.join(root, "outputs"),
        drainOnly: false,
        manifestPath: path.join(root, "manifest.json"),
      }),
    ).rejects.toMatchObject({ code: "SESSION_LEDGER_MISMATCH" });
    expect(calls).toEqual(["meta_ai_ensure_sessions"]);
  });

  it("binds committed manifest entries to exact durable provider records", async () => {
    const contracts = await loadAndValidateContracts();
    const manifest = createInitialGenerationManifest(contracts);
    const records = [];
    for (let index = 0; index < 5; index += 1) {
      const entry = manifest.entries[index];
      const expected = providerBindingForJob(contracts.plan.jobs[index]);
      entry.status = "completed";
      entry.startCallCount = 1;
      entry.providerJobId = `30000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
      entry.providerLaneId = `lane-0${index + 1}`;
      entry.submissionCommitted = true;
      entry.duplicateRequest = false;
      entry.files = [{ path: `/tmp/${entry.imageId}.webp`, sha256: "d".repeat(64), bytes: 1 }];
      records.push({
        id: entry.providerJobId,
        status: "completed",
        laneId: entry.providerLaneId,
        clientRequestId: entry.clientRequestId,
        promptDigest: expected.promptDigest,
        requestDigest: expected.requestDigest,
        referenceDigest: expected.referenceDigest,
        referenceCount: expected.referenceCount,
        outputSubdirectory: expected.outputSubdirectory,
        files: [{ path: entry.files[0].path, sha256: entry.files[0].sha256, bytes: 1 }],
      });
    }
    manifest.counts.generationSubmissions = 5;
    expect(validateProviderLedgerBindings(contracts, manifest, records)).toEqual({
      bound: 5,
      committed: 5,
    });
    records[0].requestDigest = `sha256:${"e".repeat(64)}`;
    expect(() => validateProviderLedgerBindings(contracts, manifest, records)).toThrowError(
      expect.objectContaining({ code: "PROVIDER_BINDING_MISMATCH" }),
    );
    records[0].requestDigest = providerBindingForJob(
      contracts.plan.jobs[0],
    ).requestDigest;
    records[0].files[0].sha256 = "e".repeat(64);
    expect(() => validateProviderLedgerBindings(contracts, manifest, records)).toThrowError(
      expect.objectContaining({ code: "PROVIDER_FILE_BINDING_MISMATCH" }),
    );
    const pristine = createInitialGenerationManifest(contracts);
    expect(() => validateProviderLedgerBindings(contracts, pristine, [records[1]])).toThrowError(
      expect.objectContaining({ code: "PROVIDER_REQUEST_COLLISION" }),
    );
  });

  it("runs a read-only preflight and fail-closes when the shared campaign lock exists", async () => {
    const stateRoot = await temporaryRoot();
    await writeFile(path.join(stateRoot, "jobs.json"), "[]\n");
    await writeFile(
      path.join(stateRoot, "runtome-slot-claims.json"),
      `${JSON.stringify({ schemaVersion: 1, records: [] }, null, 2)}\n`,
    );
    const runner = path.join(process.cwd(), "pipeline/images/run-generation.mjs");
    const ready = await execFile(process.execPath, [
      runner,
      "--preflight",
      "--state-root",
      stateRoot,
    ]);
    const report = JSON.parse(ready.stdout);
    expect(report).toMatchObject({
      status: "READY",
      metaCallsThisCommand: 0,
      concurrencyPolicy: "ONE_META_CAMPAIGN_AT_A_TIME",
      blockers: [],
    });
    await writeFile(path.join(stateRoot, "campaign-runner.lock"), "occupied\n");
    await expect(
      execFile(process.execPath, [
        runner,
        "--preflight",
        "--state-root",
        stateRoot,
      ]),
    ).rejects.toMatchObject({ code: 1 });
  });
});

describe("machine image policy and no-clobber receipts", () => {
  it("requires the exclusive home source inside the same exact 324-asset refine chain", async () => {
    const contracts = await loadAndValidateContracts();
    const sources = contracts.plan.jobs.map((job, index) => ({
      order: job.order,
      imageId: job.imageId,
      promptSha256: job.promptSha256,
      sourcePath: `/tmp/massage-love-fixture/${job.imageId}.png`,
      sourceSha256: (index + 1).toString(16).padStart(64, "0"),
      perceptualHashAlgorithm: "dhash64-v1",
      perceptualHash: (index + 1).toString(16).padStart(16, "0"),
      pHashAlgorithm: "phash64-dct-v1",
      pHash: (index + 2).toString(16).padStart(16, "0"),
      status: "PASS",
    }));
    expect(validateApprovedSourceCoverage(contracts, sources)).toBe(sources);
    const sourceMachineFile = {
      sha256: "f".repeat(64),
      value: { sources },
    };
    const refinement = {
      schemaVersion: "massage-love-responsive-refinement/v1",
      status: "REFINED_AWAITING_MACHINE_AND_HUMAN_QA",
      bindings: { sourceMachineReportSha256: sourceMachineFile.sha256 },
      counts: { assets: 324, variants: 972 },
      assets: sources.map((source) => ({
        order: source.order,
        assetId: source.imageId,
        sourcePath: source.sourcePath,
        sourceSha256: source.sourceSha256,
        variants: PROFILES.map((profile, profileIndex) => ({
          profile: profile.profile,
          path: `pipeline/images/refined/v1/${source.imageId}/${profile.profile}.webp`,
          sha256: (source.order * 3 + profileIndex + 1).toString(16).padStart(64, "0"),
          bytes: 1000 + profileIndex,
          width: profile.width,
          height: profile.height,
          focusX: profile.focusX,
          format: "webp",
          perceptualHashAlgorithm: "dhash64-v1",
          perceptualHash: (source.order + profileIndex).toString(16).padStart(16, "0"),
          pHashAlgorithm: "phash64-dct-v1",
          pHash: (source.order + profileIndex + 1).toString(16).padStart(16, "0"),
        })),
      })),
    };
    expect(
      validateRefinementCoverage(contracts, refinement, sourceMachineFile),
    ).toBe(refinement);
    const withoutHome = sources.map((source) => ({ ...source }));
    withoutHome[0].imageId = "MLV-RH-001";
    expect(() => validateApprovedSourceCoverage(contracts, withoutHome)).toThrowError(
      expect.objectContaining({ code: "SOURCE_COVERAGE_BINDING_INVALID" }),
    );
  });

  it("computes deterministic DCT pHash distance and top-18-percent translucent palette", async () => {
    const top = await sharp({
      create: { width: 100, height: 18, channels: 3, background: "#632a35" },
    }).png().toBuffer();
    const bottom = await sharp({
      create: { width: 100, height: 82, channels: 3, background: "#ddd4cf" },
    }).png().toBuffer();
    const image = await sharp({
      create: { width: 100, height: 100, channels: 3, background: "#ffffff" },
    }).composite([{ input: top, top: 0, left: 0 }, { input: bottom, top: 18, left: 0 }]).png().toBuffer();
    const [dHash, pHash] = await Promise.all([dhash64(image), phash64(image)]);
    expect(dHash).toMatch(/^[a-f0-9]{16}$/);
    expect(pHash).toMatch(/^[a-f0-9]{16}$/);
    expect(hammingDhash(dHash, dHash)).toBe(0);
    expect(hammingPHash(pHash, pHash)).toBe(0);
    const palette = await extractTopPalette(image, "a".repeat(64));
    expect(palette.algorithm).toBe("top-18-percent-quantized-rgb-v1");
    expect(palette.sample.topFraction).toBe(0.18);
    expect(palette.dominantHex).toMatch(/^#[a-f0-9]{6}$/);
    expect(palette.style["--route-header-start"]).toContain("0.94");
    expect(palette.style["--route-header-mid"]).toContain("0.91");
    expect(palette.style["--route-header-end"]).toContain("0.88");
  });

  it("uses exact responsive crop profiles without updatable heuristics", () => {
    expect(PROFILES.map(({ profile, width, height, focusX }) => ({ profile, width, height, focusX }))).toEqual([
      { profile: "desktop", width: 2048, height: 922, focusX: 0.5 },
      { profile: "tablet", width: 1536, height: 1024, focusX: 0.58 },
      { profile: "mobile", width: 1024, height: 2048, focusX: 0.69 },
    ]);
    expect(cropGeometry(2048, 1152, PROFILES[0])).toEqual({ left: 0, top: 115, width: 2048, height: 922 });
    expect(cropGeometry(2048, 1152, PROFILES[2])).toEqual({ left: 1125, top: 0, width: 576, height: 1152 });
  });

  it("never overwrites an immutable receipt with different bytes", async () => {
    const root = await temporaryRoot();
    const receipt = path.join(root, "receipt.json");
    await atomicNoClobberJson(receipt, { status: "PASS", value: 1 });
    await atomicNoClobberJson(receipt, { status: "PASS", value: 1 });
    await expect(
      atomicNoClobberJson(receipt, { status: "PASS", value: 2 }),
    ).rejects.toMatchObject({ code: "NO_CLOBBER_CONFLICT" });
  });
});

describe("current repository remains fail closed without images", () => {
  it("has zero submitted jobs and refuses source QA", async () => {
    const manifest = (await readJsonFile(GENERATION_MANIFEST_PATH)).value;
    expect(manifest.counts).toMatchObject({ planned: 324, completed: 0, generationSubmissions: 0 });
    await expect(runSourceMachineQa()).rejects.toMatchObject({ code: "ALL_SOURCES_REQUIRED" });
  });

  it("refuses public promotion before all source and refined human approvals", async () => {
    await expect(promoteApprovedRelease()).rejects.toBeInstanceOf(Error);
  });
});
