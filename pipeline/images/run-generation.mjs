#!/usr/bin/env node

import { lstat, mkdir, open, readFile, realpath, rm } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  EXPECTED_JOB_COUNT,
  GENERATION_MANIFEST_PATH,
  MAX_WAIT_CALLS,
  PIPELINE_ROOT,
  PROJECT_ROOT,
  RUNTIME_LANES,
  PipelineError,
  atomicNoClobberJson,
  atomicReplaceJson,
  createInitialGenerationManifest,
  isInside,
  loadAndValidateContracts,
  providerBindingForJob,
  readJsonFile,
  recomputeGenerationCounts,
  sha256,
  validateGenerationManifest,
  verifyFileRecord,
} from "./lib.mjs";

const MCP_ROOT = path.resolve(PROJECT_ROOT, "../runtome/mcp/meta-ai-image-mcp");
const MCP_SERVER = path.join(MCP_ROOT, "bin/meta-ai-image-mcp.mjs");
const SDK_ROOT = path.join(
  MCP_ROOT,
  "node_modules/@modelcontextprotocol/sdk/dist/esm",
);
const DEFAULT_STATE_ROOT = path.join(homedir(), ".codex/state/meta-ai-image");
const DEFAULT_OUTPUT_ROOT = path.join(homedir(), "Documents/Codex/meta-ai-output");
const LOCK_PATH = path.join(PIPELINE_ROOT, "state/runner.lock");
const LIVE_CONFIRMATION = "I_AUTHORIZE_324_TEXT_ONLY_META_SUBMISSIONS";
const WAIT_SECONDS = 50;

function parseArgs(argv) {
  const command = argv.includes("--live")
    ? "live"
    : argv.includes("--preflight")
      ? "preflight"
    : argv.includes("--init")
      ? "init"
      : argv.includes("--status")
        ? "status"
        : "validate";
  const valueAfter = (flag) => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : null;
  };
  return {
    command,
    confirm: valueAfter("--confirm"),
    drainOnly: argv.includes("--drain-only"),
    stateRoot: path.resolve(valueAfter("--state-root") ?? DEFAULT_STATE_ROOT),
    outputRoot: path.resolve(valueAfter("--output-root") ?? DEFAULT_OUTPUT_ROOT),
  };
}

function log(event, data = {}) {
  process.stdout.write(`${JSON.stringify({ event, ...data })}\n`);
}

async function initManifest(contracts) {
  const initial = createInitialGenerationManifest(contracts);
  await atomicNoClobberJson(GENERATION_MANIFEST_PATH, initial);
  const current = (await readJsonFile(GENERATION_MANIFEST_PATH)).value;
  validateGenerationManifest(contracts, current);
  return current;
}

async function loadManifest(contracts) {
  try {
    const manifest = (await readJsonFile(GENERATION_MANIFEST_PATH)).value;
    return validateGenerationManifest(contracts, manifest);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    return initManifest(contracts);
  }
}

function createSaveQueue(manifest, manifestPath = GENERATION_MANIFEST_PATH) {
  let queue = Promise.resolve();
  return async () => {
    recomputeGenerationCounts(manifest);
    queue = queue.then(() => atomicReplaceJson(manifestPath, manifest));
    await queue;
  };
}

function structuredValue(result) {
  if (result?.structuredContent) return result.structuredContent;
  const text = result?.content?.find((item) => item.type === "text")?.text;
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { rawText: text };
  }
}

async function callTool(client, name, args, { allowedCodes = [], timeout = 120_000 } = {}) {
  let result;
  try {
    result = await client.callTool({ name, arguments: args }, undefined, { timeout });
  } catch (error) {
    throw new PipelineError(
      name === "meta_ai_start_image_generation"
        ? "SUBMISSION_OUTCOME_UNKNOWN"
        : "MCP_TRANSPORT_FAILURE",
      `${name} transport failed`,
      { message: error?.message ?? String(error) },
    );
  }
  const value = structuredValue(result);
  const code = value?.error?.code;
  if (result?.isError && !allowedCodes.includes(code)) {
    throw new PipelineError(code ?? "MCP_TOOL_ERROR", `${name} failed`, value);
  }
  return value;
}

function assertPoolSafe(pool, { allReady }) {
  if (
    pool?.global_uncertainty?.blocked ||
    pool?.configured_lane_count !== RUNTIME_LANES ||
    pool?.effective_lane_count !== RUNTIME_LANES ||
    pool?.globally_paused ||
    pool?.downshift_recommended ||
    (allReady && pool?.ready_lane_count !== RUNTIME_LANES)
  ) {
    throw new PipelineError("POOL_NOT_SAFE", "five-lane pool is not safe", pool);
  }
}

function assertSessionsSafe(session) {
  if (
    !session?.ok ||
    session.status !== "authenticated" ||
    !Array.isArray(session.lanes) ||
    session.lanes.length !== RUNTIME_LANES ||
    !session.lanes.every(
      (lane) =>
        lane.status === "ready" &&
        Number.isSafeInteger(lane.generation_submissions) &&
        lane.generation_submissions === 0,
    )
  ) {
    throw new PipelineError(
      "SESSION_LEDGER_MISMATCH",
      "five newly prepared authenticated lanes must each report zero submissions",
      { session },
    );
  }
}

export function validateProviderLedgerBindings(contracts, manifest, providerJobs) {
  if (!Array.isArray(providerJobs)) {
    throw new PipelineError(
      "PROVIDER_STATE_INVALID",
      "jobs.json must contain an array of durable provider jobs",
    );
  }
  const byRequest = new Map();
  for (const record of providerJobs) {
    if (typeof record?.clientRequestId !== "string") continue;
    const matches = byRequest.get(record.clientRequestId) ?? [];
    matches.push(record);
    byRequest.set(record.clientRequestId, matches);
  }
  let bound = 0;
  let committed = 0;
  for (const [index, entry] of manifest.entries.entries()) {
    const job = contracts.plan.jobs[index];
    const expected = providerBindingForJob(job);
    const matches = byRequest.get(entry.clientRequestId) ?? [];
    if (matches.length > 1) {
      throw new PipelineError(
        "PROVIDER_REQUEST_DUPLICATE",
        `${entry.imageId} has multiple durable provider jobs`,
      );
    }
    const requiresProvider = [
      "generating",
      "started_completed",
      "downloading",
      "completed",
    ].includes(entry.status);
    if (entry.status === "planned" && matches.length !== 0) {
      throw new PipelineError(
        "PROVIDER_REQUEST_COLLISION",
        `${entry.imageId} is planned but its request ID already exists in jobs.json`,
      );
    }
    if (requiresProvider && matches.length !== 1) {
      throw new PipelineError(
        "PROVIDER_BINDING_MISSING",
        `${entry.imageId} lacks its exact durable provider job`,
      );
    }
    if (matches.length === 0) continue;
    const record = matches[0];
    if (
      record.id !== entry.providerJobId ||
      record.laneId !== entry.providerLaneId ||
      !/^lane-0[1-5]$/.test(String(record.laneId ?? "")) ||
      record.clientRequestId !== entry.clientRequestId ||
      record.promptDigest !== expected.promptDigest ||
      record.requestDigest !== expected.requestDigest ||
      record.referenceDigest !== expected.referenceDigest ||
      record.referenceCount !== expected.referenceCount ||
      record.outputSubdirectory !== expected.outputSubdirectory
    ) {
      throw new PipelineError(
        "PROVIDER_BINDING_MISMATCH",
        `${entry.imageId} durable provider binding differs from the immutable plan`,
      );
    }
    if (entry.status === "completed" && record.status !== "completed") {
      throw new PipelineError(
        "PROVIDER_TERMINAL_STATE_MISMATCH",
        `${entry.imageId} is locally completed but provider state is ${record.status}`,
      );
    }
    if (
      requiresProvider &&
      !["submitting", "generating", "downloading", "completed"].includes(
        record.status,
      )
    ) {
      throw new PipelineError(
        "PROVIDER_JOB_STATE_MISMATCH",
        `${entry.imageId} active provider state is ${record.status}`,
      );
    }
    if (
      entry.status === "completed" &&
      (!Array.isArray(record.files) ||
        record.files.length !== 1 ||
        record.files[0]?.path !== entry.files[0]?.path ||
        record.files[0]?.sha256 !== entry.files[0]?.sha256 ||
        record.files[0]?.bytes !== entry.files[0]?.bytes)
    ) {
      throw new PipelineError(
        "PROVIDER_FILE_BINDING_MISMATCH",
        `${entry.imageId} completed file differs from the durable provider result`,
      );
    }
    bound += 1;
    if (entry.submissionCommitted) committed += 1;
  }
  if (committed !== manifest.counts.generationSubmissions) {
    throw new PipelineError(
      "PROVIDER_COMMITTED_COUNT_MISMATCH",
      "durably bound committed jobs do not match the campaign submission count",
      { committed, manifest: manifest.counts.generationSubmissions },
    );
  }
  return { bound, committed };
}

async function verifyCompletedEntries(manifest, outputRoot) {
  const providerJobs = new Set();
  const sourcePaths = new Set();
  const sourceHashes = new Set();
  for (const entry of manifest.entries) {
    if (entry.status !== "completed") continue;
    const file = await verifyFileRecord(entry.files[0], {
      allowedRoot: path.join(outputRoot, entry.outputSubdirectory),
    });
    entry.files[0].path = await realpath(file.path);
    providerJobs.add(entry.providerJobId);
    sourcePaths.add(entry.files[0].path);
    sourceHashes.add(entry.files[0].sha256);
  }
  const completed = manifest.entries.filter((entry) => entry.status === "completed").length;
  if (
    providerJobs.size !== completed ||
    sourcePaths.size !== completed ||
    sourceHashes.size !== completed
  ) {
    throw new PipelineError(
      "COMPLETED_SOURCE_DUPLICATE",
      "completed jobs, source paths, and source hashes must be unique",
    );
  }
}

async function startOne(client, job, entry, manifest, save) {
  if (entry.status === "completed" || entry.providerJobId) return;
  if (entry.status !== "planned") {
    throw new PipelineError(
      "ENTRY_NOT_STARTABLE",
      `${entry.imageId} cannot start from ${entry.status}`,
    );
  }
  entry.status = "starting";
  entry.startCallCount += 1;
  entry.error = null;
  await save();
  let started;
  try {
    started = await callTool(client, "meta_ai_start_image_generation", {
      prompt: job.prompt,
      output_subdirectory: entry.outputSubdirectory,
      client_request_id: entry.clientRequestId,
    });
  } catch (error) {
    if (
      error.code === "SUBMISSION_UNCERTAIN" ||
      error.code === "SUBMISSION_OUTCOME_UNKNOWN"
    ) {
      entry.status = "submission_uncertain";
      entry.error = { code: error.code, message: error.message };
      manifest.status = "BLOCKED_GLOBAL_UNCERTAINTY";
      manifest.blocked = { code: error.code, imageId: entry.imageId };
      await save();
      throw error;
    }
    entry.status = "failed";
    entry.error = { code: error.code ?? "START_FAILED", message: error.message };
    await save();
    throw error;
  }
  const expectedProviderBinding = providerBindingForJob(job);
  if (
    !started?.ok ||
    typeof started.job_id !== "string" ||
    !/^lane-0[1-5]$/.test(String(started.lane_id ?? ""))
  ) {
    entry.providerJobId = typeof started?.job_id === "string" ? started.job_id : null;
    entry.providerLaneId = typeof started?.lane_id === "string" ? started.lane_id : null;
    entry.duplicateRequest =
      typeof started?.duplicate_request === "boolean"
        ? started.duplicate_request
        : null;
    entry.submissionCommitted = started?.duplicate_request === false;
    if (entry.submissionCommitted) manifest.counts.generationSubmissions += 1;
    entry.status = "submission_uncertain";
    entry.error = {
      code: "START_BINDING_INVALID",
      message: "provider response did not supply an exact job/lane binding",
    };
    manifest.status = "BLOCKED_GLOBAL_UNCERTAINTY";
    manifest.blocked = { code: "START_BINDING_INVALID", imageId: entry.imageId };
    await save();
    throw new PipelineError(
      "START_BINDING_INVALID",
      `${entry.imageId} did not bind exactly one provider job/lane`,
      started,
    );
  }
  if (
    started.prompt_digest !== expectedProviderBinding.promptDigest ||
    started.request_digest !== expectedProviderBinding.requestDigest ||
    started.reference_digest !== expectedProviderBinding.referenceDigest ||
    started.reference_count !== expectedProviderBinding.referenceCount
  ) {
    entry.providerJobId = started.job_id;
    entry.providerLaneId = started.lane_id;
    entry.duplicateRequest =
      typeof started.duplicate_request === "boolean"
        ? started.duplicate_request
        : null;
    entry.submissionCommitted = started.duplicate_request === false;
    if (entry.submissionCommitted) manifest.counts.generationSubmissions += 1;
    entry.status = "submission_uncertain";
    entry.error = {
      code: "START_PROVIDER_DIGEST_MISMATCH",
      message: "provider prompt/request/reference binding differs from the immutable plan",
    };
    manifest.status = "BLOCKED_GLOBAL_UNCERTAINTY";
    manifest.blocked = {
      code: "START_PROVIDER_DIGEST_MISMATCH",
      imageId: entry.imageId,
    };
    await save();
    throw new PipelineError(
      "START_PROVIDER_DIGEST_MISMATCH",
      `${entry.imageId} provider digest binding differs from the immutable plan`,
      {
        expected: expectedProviderBinding,
        actual: {
          promptDigest: started.prompt_digest ?? null,
          requestDigest: started.request_digest ?? null,
          referenceDigest: started.reference_digest ?? null,
          referenceCount: started.reference_count ?? null,
        },
      },
    );
  }
  if (started.duplicate_request !== false) {
    entry.providerJobId = started.job_id;
    entry.providerLaneId = started.lane_id;
    entry.status = "submission_uncertain";
    entry.error = {
      code: "UNEXPECTED_DUPLICATE_REQUEST",
      message: "a planned request unexpectedly resolved to an existing provider job",
    };
    manifest.status = "BLOCKED_GLOBAL_UNCERTAINTY";
    manifest.blocked = {
      code: "UNEXPECTED_DUPLICATE_REQUEST",
      imageId: entry.imageId,
    };
    await save();
    throw new PipelineError(
      "UNEXPECTED_DUPLICATE_REQUEST",
      `${entry.imageId} unexpectedly resolved as a duplicate request; do not resend`,
    );
  }
  entry.providerJobId = started.job_id;
  entry.providerLaneId = started.lane_id;
  entry.duplicateRequest = false;
  entry.submissionCommitted = true;
  entry.status = started.status === "completed" ? "started_completed" : "generating";
  if (entry.submissionCommitted) manifest.counts.generationSubmissions += 1;
  entry.error = null;
  await save();
  log("generation_started", {
    imageId: entry.imageId,
    providerJobId: entry.providerJobId,
    providerLaneId: entry.providerLaneId,
    duplicateRequest: entry.duplicateRequest,
  });
}

async function waitOne(client, entry, outputRoot, save) {
  if (entry.status === "completed") return;
  if (!entry.providerJobId) {
    throw new PipelineError("PROVIDER_JOB_MISSING", `${entry.imageId} has no provider job`);
  }
  if (entry.waitCallCount >= MAX_WAIT_CALLS) {
    throw new PipelineError(
      "WAIT_LIMIT_REACHED",
      `${entry.imageId} already used all ${MAX_WAIT_CALLS} waits; inspect the existing job`,
    );
  }
  for (let call = entry.waitCallCount + 1; call <= MAX_WAIT_CALLS; call += 1) {
    const result = await callTool(
      client,
      "meta_ai_wait_and_download",
      { job_id: entry.providerJobId, timeout_seconds: WAIT_SECONDS },
      { allowedCodes: ["DOWNLOAD_MISSING"], timeout: 90_000 },
    );
    entry.waitCallCount = call;
    if (result?.ok && result.status === "completed") {
      if (
        result.job_id !== entry.providerJobId ||
        result.lane_id !== entry.providerLaneId ||
        !Array.isArray(result.files) ||
        result.files.length !== 1
      ) {
        throw new PipelineError(
          "COMPLETION_BINDING_INVALID",
          `${entry.imageId} completion did not match its job/lane/single-file contract`,
          result,
        );
      }
      const candidate = result.files[0];
      if (!path.isAbsolute(candidate.path)) {
        throw new PipelineError(
          "DOWNLOADED_FILE_INVALID",
          `${entry.imageId} downloaded file failed path/hash/size binding`,
        );
      }
      const absolutePath = await realpath(candidate.path);
      const expectedOutputRoot = await realpath(
        path.join(outputRoot, entry.outputSubdirectory),
      );
      const bytes = await readFile(absolutePath);
      if (
        !isInside(expectedOutputRoot, absolutePath) ||
        sha256(bytes) !== candidate.sha256 ||
        bytes.length !== candidate.bytes
      ) {
        throw new PipelineError(
          "DOWNLOADED_FILE_INVALID",
          `${entry.imageId} downloaded file failed path/hash/size binding`,
        );
      }
      entry.files = [
        {
          path: absolutePath,
          sha256: candidate.sha256,
          bytes: candidate.bytes,
          mimeType: candidate.mime_type ?? candidate.mimeType ?? null,
        },
      ];
      entry.status = "completed";
      entry.error = null;
      await save();
      log("generation_completed", {
        imageId: entry.imageId,
        providerJobId: entry.providerJobId,
        sha256: candidate.sha256,
      });
      return;
    }
    if (result?.error?.code === "DOWNLOAD_MISSING" && result.error.retryable === false) {
      entry.status = "failed";
      entry.error = { code: "DOWNLOAD_TERMINAL", message: "download is terminal" };
      await save();
      throw new PipelineError(
        "DOWNLOAD_TERMINAL",
        `${entry.imageId} has a terminal missing download`,
        result,
      );
    }
    entry.status = "generating";
    await save();
    log("generation_pending", {
      imageId: entry.imageId,
      providerJobId: entry.providerJobId,
      waitCallCount: call,
    });
    const retryAfter = Number(result?.retry_after_ms ?? 0);
    if (retryAfter > 0 && call < MAX_WAIT_CALLS) {
      await new Promise((resolve) => setTimeout(resolve, Math.min(retryAfter, 60_000)));
    }
  }
  throw new PipelineError(
    "WAIT_EXHAUSTED",
    `${entry.imageId} remains pending after ${MAX_WAIT_CALLS} waits; no replacement was sent`,
  );
}

async function acquireLock() {
  return acquireNamedLock(LOCK_PATH, "massage-love-local-runner");
}

async function acquireNamedLock(lockPath, kind) {
  await mkdir(path.dirname(lockPath), { recursive: true, mode: 0o700 });
  let handle;
  try {
    handle = await open(lockPath, "wx", 0o600);
    await handle.writeFile(
      `${JSON.stringify({
        schemaVersion: "meta-ai-campaign-lock/v1",
        campaignId: "massage-love-image-campaign-v1",
        kind,
        pid: process.pid,
      })}\n`,
      "utf8",
    );
    await handle.sync();
    return handle;
  } catch (error) {
    await handle?.close().catch(() => undefined);
    if (handle) await rm(lockPath, { force: true });
    if (error?.code === "EEXIST") {
      throw new PipelineError(
        "RUNNER_LOCKED",
        `another image runner owns ${lockPath}`,
      );
    }
    throw error;
  }
}

async function pathExists(filePath) {
  try {
    await lstat(filePath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function summarizeProviderRecords(records, label) {
  if (!Array.isArray(records)) {
    throw new PipelineError(
      "PROVIDER_STATE_INVALID",
      `${label} must contain an array of durable records`,
    );
  }
  const terminal = new Set([
    "completed",
    "failed",
    "owner_cutoff_delayed",
    "owner_abandoned",
    "cancelled",
  ]);
  const statuses = {};
  const nonterminal = [];
  const uncertain = [];
  for (const record of records) {
    const status = String(record?.status ?? "missing");
    statuses[status] = (statuses[status] ?? 0) + 1;
    if (!terminal.has(status)) {
      nonterminal.push({
        id: record?.id ?? record?.jobId ?? record?.slot ?? null,
        status,
        clientRequestId: record?.clientRequestId ?? null,
        laneId: record?.laneId ?? null,
      });
    }
    if (record?.submission_uncertain === true || status === "submission_uncertain") {
      uncertain.push({
        id: record?.id ?? record?.jobId ?? record?.slot ?? null,
        status,
        clientRequestId: record?.clientRequestId ?? null,
      });
    }
  }
  return { total: records.length, statuses, nonterminal, uncertain };
}

async function readProviderArray(filePath, key = null) {
  const file = await readJsonFile(filePath);
  const records = key === null ? file.value : file.value?.[key];
  return { file, records };
}

async function runPreflight(contracts, manifest, args) {
  const globalLockPath = path.join(args.stateRoot, "campaign-runner.lock");
  const jobsPath = path.join(args.stateRoot, "jobs.json");
  const slotClaimsPath = path.join(args.stateRoot, "runtome-slot-claims.json");
  const manifestFile = await readJsonFile(GENERATION_MANIFEST_PATH);
  const blockers = [];
  const campaignRequestIds = new Set(
    manifest.entries.map((entry) => entry.clientRequestId),
  );
  const [localLockPresent, globalLockPresent] = await Promise.all([
    pathExists(LOCK_PATH),
    pathExists(globalLockPath),
  ]);
  if (localLockPresent) blockers.push("massageLoveRunnerLockPresent");
  if (globalLockPresent) blockers.push("globalMetaCampaignLockPresent");

  let jobs = null;
  let slots = null;
  let providerBinding = null;
  let providerJobRecords = null;
  if (!(await pathExists(jobsPath))) {
    blockers.push("globalJobsLedgerMissing");
  } else {
    const loaded = await readProviderArray(jobsPath);
    providerJobRecords = loaded.records;
    jobs = {
      path: jobsPath,
      sha256: loaded.file.sha256,
      ...summarizeProviderRecords(loaded.records, "jobs.json"),
    };
    const foreignNonterminal = jobs.nonterminal.filter(
      (record) => !campaignRequestIds.has(record.clientRequestId),
    );
    if (
      foreignNonterminal.length ||
      (!args.drainOnly && jobs.nonterminal.length)
    ) {
      blockers.push("globalProviderJobsNonterminal");
    }
    if (jobs.uncertain.length) blockers.push("globalProviderSubmissionUncertain");
  }
  if (!(await pathExists(slotClaimsPath))) {
    blockers.push("globalSlotClaimsMissing");
  } else {
    const loaded = await readProviderArray(slotClaimsPath, "records");
    slots = {
      path: slotClaimsPath,
      sha256: loaded.file.sha256,
      ...summarizeProviderRecords(loaded.records, "runtome-slot-claims.json"),
    };
    if (slots.nonterminal.length) blockers.push("globalSlotClaimsNonterminal");
    if (slots.uncertain.length) blockers.push("globalSlotSubmissionUncertain");
  }

  if (manifest.counts.active && !args.drainOnly) {
    blockers.push("massageLoveActiveJobsRequireDrain");
  }
  if (manifest.counts.uncertain) blockers.push("massageLoveSubmissionUncertain");
  if (manifest.counts.failed) blockers.push("massageLoveFailedEntriesRequireResolution");
  if (manifest.counts.planned + manifest.counts.completed !== EXPECTED_JOB_COUNT) {
    blockers.push("massageLoveLedgerCardinalityInvalid");
  }
  if (providerJobRecords) {
    try {
      providerBinding = validateProviderLedgerBindings(
        contracts,
        manifest,
        providerJobRecords,
      );
    } catch (error) {
      blockers.push(`providerLedgerBinding:${error.code ?? "INVALID"}`);
      providerBinding = {
        status: "INVALID",
        code: error.code ?? "INVALID",
        message: error.message,
      };
    }
  }
  const dependencies = {
    mcpServer: MCP_SERVER,
    mcpServerPresent: await pathExists(MCP_SERVER),
    sdkClient: path.join(SDK_ROOT, "client/index.js"),
    sdkClientPresent: await pathExists(path.join(SDK_ROOT, "client/index.js")),
  };
  if (!dependencies.mcpServerPresent || !dependencies.sdkClientPresent) {
    blockers.push("runnerDependencyMissing");
  }
  const report = {
    schemaVersion: "massage-love-meta-preflight/v1",
    status: blockers.length ? "BLOCKED" : "READY",
    metaCallsThisCommand: 0,
    concurrencyPolicy: "ONE_META_CAMPAIGN_AT_A_TIME",
    campaignId: "massage-love-image-campaign-v1",
    contracts: {
      jobs: EXPECTED_JOB_COUNT,
      waves: contracts.plan.waves.length,
      lanes: RUNTIME_LANES,
      planFileSha256: contracts.planFileSha256,
      campaignFileSha256: contracts.campaignFileSha256,
    },
    manifest: {
      path: GENERATION_MANIFEST_PATH,
      sha256: manifestFile.sha256,
      status: manifest.status,
      counts: manifest.counts,
      providerOutputRoot: manifest.providerOutputRoot ?? null,
    },
    locks: {
      local: { path: LOCK_PATH, present: localLockPresent },
      global: { path: globalLockPath, present: globalLockPresent },
    },
    providerState: { jobs, slots, campaignBinding: providerBinding },
    dependencies,
    blockers,
    nextCommand:
      blockers.length === 0
        ? "node pipeline/images/run-generation.mjs --live --confirm I_AUTHORIZE_324_TEXT_ONLY_META_SUBMISSIONS"
        : null,
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (blockers.length) {
    throw new PipelineError("PREFLIGHT_BLOCKED", "Meta preflight has blocking conditions", {
      blockers,
    });
  }
  return report;
}

async function assertLiveProviderStateSafe(
  contracts,
  manifest,
  stateRoot,
  { drainOnly },
) {
  const jobs = await readProviderArray(path.join(stateRoot, "jobs.json"));
  const slots = await readProviderArray(
    path.join(stateRoot, "runtome-slot-claims.json"),
    "records",
  );
  const jobSummary = summarizeProviderRecords(jobs.records, "jobs.json");
  const slotSummary = summarizeProviderRecords(
    slots.records,
    "runtome-slot-claims.json",
  );
  const campaignRequestIds = new Set(
    manifest.entries.map((entry) => entry.clientRequestId),
  );
  const foreignNonterminal = jobSummary.nonterminal.filter(
    (record) => !campaignRequestIds.has(record.clientRequestId),
  );
  if (
    foreignNonterminal.length ||
    (!drainOnly && jobSummary.nonterminal.length) ||
    jobSummary.uncertain.length ||
    slotSummary.nonterminal.length ||
    slotSummary.uncertain.length
  ) {
    throw new PipelineError(
      "GLOBAL_PROVIDER_STATE_CHANGED",
      "global provider state became unsafe after preflight",
      { jobs: jobSummary, slots: slotSummary },
    );
  }
  return validateProviderLedgerBindings(contracts, manifest, jobs.records);
}

async function createClient({ stateRoot, outputRoot }) {
  const { Client } = await import(
    pathToFileURL(path.join(SDK_ROOT, "client/index.js")).href
  );
  const { StdioClientTransport } = await import(
    pathToFileURL(path.join(SDK_ROOT, "client/stdio.js")).href
  );
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [MCP_SERVER],
    cwd: MCP_ROOT,
    env: {
      ...process.env,
      META_AI_STATE_DIR: stateRoot,
      META_AI_OUTPUT_ROOT: outputRoot,
      META_AI_LANE_COUNT: String(RUNTIME_LANES),
      META_AI_HEADLESS: "false",
      META_AI_REFERENCE_UPLOAD_CONTRACT_VERIFIED: "false",
      META_AI_RUNTOME_20260811_ROLLOVER_CONTINUATION: "false",
    },
    stderr: "inherit",
  });
  const client = new Client({ name: "massage-love-image-runner", version: "1.0.0" });
  await client.connect(transport);
  return client;
}

export async function runWithClient({
  contracts,
  manifest,
  client,
  outputRoot,
  drainOnly,
  manifestPath = GENERATION_MANIFEST_PATH,
}) {
  const save = createSaveQueue(manifest, manifestPath);
  await mkdir(outputRoot, { recursive: true, mode: 0o700 });
  const resolvedOutputRoot = await realpath(outputRoot);
  if (
    manifest.providerOutputRoot != null &&
    manifest.providerOutputRoot !== resolvedOutputRoot
  ) {
    throw new PipelineError(
      "GENERATION_OUTPUT_ROOT_DRIFT",
      "provider output root differs from the durable campaign binding",
      { expected: manifest.providerOutputRoot, actual: resolvedOutputRoot },
    );
  }
  manifest.providerOutputRoot = resolvedOutputRoot;

  for (const entry of manifest.entries) {
    if (entry.status !== "starting") continue;
    entry.status = "submission_uncertain";
    entry.error = {
      code: "INTERRUPTED_START_REQUIRES_RECONCILIATION",
      message: "runner stopped after persisting start intent but before binding a provider job",
    };
  }
  manifest.status = "RUNNING";
  manifest.blocked = null;
  await save();

  const active = manifest.entries.filter((entry) =>
    ["generating", "started_completed", "downloading"].includes(entry.status),
  );
  if (active.length > RUNTIME_LANES) {
    throw new PipelineError("ACTIVE_COUNT_INVALID", "more than five persisted jobs are active");
  }
  if (active.length) {
    log("drain_first_started", { active: active.map((entry) => entry.imageId) });
    const drained = await Promise.allSettled(
      active.map((entry) => waitOne(client, entry, outputRoot, save)),
    );
    const failure = drained.find((result) => result.status === "rejected");
    if (failure) throw failure.reason;
    log("drain_first_completed", { count: active.length });
  }

  const uncertain = manifest.entries.filter((entry) => entry.status === "submission_uncertain");
  if (uncertain.length) {
    manifest.status = "BLOCKED_GLOBAL_UNCERTAINTY";
    manifest.blocked = {
      code: "SUBMISSION_UNCERTAIN",
      imageIds: uncertain.map((entry) => entry.imageId),
    };
    await save();
    throw new PipelineError(
      "SUBMISSION_UNCERTAIN",
      "persisted uncertainty blocks every new submission; reconcile outside this runner",
      { imageIds: uncertain.map((entry) => entry.imageId) },
    );
  }

  if (drainOnly) {
    manifest.status = "PAUSED_AFTER_DRAIN";
    await save();
    return manifest;
  }

  const session = await callTool(client, "meta_ai_ensure_sessions", {
    timeout_seconds: 50,
    click_saved_account: true,
  });
  assertSessionsSafe(session);
  assertPoolSafe(await callTool(client, "meta_ai_pool_status", {}), { allReady: true });

  for (const wave of contracts.plan.waves) {
    const entries = wave.lanes.map((lane) =>
      manifest.entries.find((entry) => entry.jobId === lane.jobId),
    );
    const incomplete = entries.filter((entry) => entry.status !== "completed");
    if (!incomplete.length) continue;
    if (incomplete.some((entry) => entry.status !== "planned")) {
      throw new PipelineError(
        "WAVE_NOT_STARTABLE",
        `wave ${wave.wave} contains a nonterminal non-planned entry`,
      );
    }
    assertPoolSafe(await callTool(client, "meta_ai_pool_status", {}), { allReady: true });
    const starts = await Promise.allSettled(
      incomplete.map((entry) =>
        startOne(
          client,
          contracts.plan.jobs[entry.order - 1],
          entry,
          manifest,
          save,
        ),
      ),
    );
    const startFailure = starts.find((result) => result.status === "rejected");
    if (startFailure) throw startFailure.reason;
    assertPoolSafe(await callTool(client, "meta_ai_pool_status", {}), { allReady: false });
    const waits = await Promise.allSettled(
      incomplete.map((entry) => waitOne(client, entry, outputRoot, save)),
    );
    const waitFailure = waits.find((result) => result.status === "rejected");
    if (waitFailure) throw waitFailure.reason;
    assertPoolSafe(await callTool(client, "meta_ai_pool_status", {}), { allReady: true });
    log("wave_completed", { wave: wave.wave, jobs: incomplete.length });
  }

  await verifyCompletedEntries(manifest, outputRoot);
  if (manifest.entries.some((entry) => entry.status !== "completed")) {
    throw new PipelineError("GENERATION_INCOMPLETE", "not all 324 sources completed");
  }
  manifest.status = "SOURCES_COMPLETE_AWAITING_QA";
  manifest.blocked = null;
  await save();
  return manifest;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const contracts = await loadAndValidateContracts();
  const manifest = await loadManifest(contracts);
  await verifyCompletedEntries(manifest, manifest.providerOutputRoot ?? args.outputRoot);
  if (args.command === "preflight") {
    await runPreflight(contracts, manifest, args);
    return;
  }
  if (args.command === "init" || args.command === "validate" || args.command === "status") {
    log(args.command === "status" ? "generation_status" : "generation_contract_valid", {
      manifest: GENERATION_MANIFEST_PATH,
      status: manifest.status,
      counts: manifest.counts,
      planFileSha256: contracts.planFileSha256,
      campaignFileSha256: contracts.campaignFileSha256,
      metaCallsThisCommand: 0,
    });
    return;
  }
  if (args.confirm !== LIVE_CONFIRMATION) {
    throw new PipelineError(
      "LIVE_CONFIRMATION_REQUIRED",
      `--live requires --confirm ${LIVE_CONFIRMATION}`,
    );
  }
  await runPreflight(contracts, manifest, args);
  const globalLockPath = path.join(args.stateRoot, "campaign-runner.lock");
  let globalLock;
  let lock;
  try {
    globalLock = await acquireNamedLock(globalLockPath, "global-meta-campaign");
    lock = await acquireLock();
  } catch (error) {
    await lock?.close().catch(() => undefined);
    await globalLock?.close().catch(() => undefined);
    if (lock) await rm(LOCK_PATH, { force: true });
    if (globalLock) await rm(globalLockPath, { force: true });
    throw error;
  }
  let client;
  try {
    await assertLiveProviderStateSafe(contracts, manifest, args.stateRoot, {
      drainOnly: args.drainOnly,
    });
    client = await createClient(args);
    await runWithClient({
      contracts,
      manifest,
      client,
      outputRoot: args.outputRoot,
      drainOnly: args.drainOnly,
    });
  } catch (error) {
    manifest.status = "BLOCKED";
    manifest.blocked = {
      code: error?.code ?? "UNKNOWN_FAILURE",
      message: error?.message ?? String(error),
    };
    await atomicReplaceJson(GENERATION_MANIFEST_PATH, manifest);
    throw error;
  } finally {
    await client?.close().catch(() => undefined);
    await lock.close().catch(() => undefined);
    await globalLock.close().catch(() => undefined);
    await rm(LOCK_PATH, { force: true });
    await rm(globalLockPath, { force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(
      `${JSON.stringify({ code: error?.code ?? "UNKNOWN", message: error?.message ?? String(error) })}\n`,
    );
    process.exitCode = 1;
  });
}
