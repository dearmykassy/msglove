import { createHash } from "node:crypto";
import {
  chmod,
  link,
  lstat,
  mkdir,
  open,
  realpath,
  rename,
  rm,
  stat,
  unlink,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

export const PROJECT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
export const PIPELINE_ROOT = path.join(PROJECT_ROOT, "pipeline/images");
export const PLAN_PATH = path.join(PROJECT_ROOT, "artifacts/image-generation-plan.json");
export const CAMPAIGN_PATH = path.join(
  PROJECT_ROOT,
  "artifacts/image-campaign-contract.json",
);
export const GENERATION_MANIFEST_PATH = path.join(
  PIPELINE_ROOT,
  "state/generation-manifest.json",
);
export const SOURCE_MACHINE_REPORT_PATH = path.join(
  PIPELINE_ROOT,
  "qa/source-machine-report.json",
);
export const SOURCE_CONTACT_MANIFEST_PATH = path.join(
  PIPELINE_ROOT,
  "qa/source-contact-sheets/manifest.json",
);
export const SOURCE_REVIEW_PATH = path.join(
  PIPELINE_ROOT,
  "reviews/source-human-review.json",
);
export const REFINEMENT_MANIFEST_PATH = path.join(
  PIPELINE_ROOT,
  "refined/v1/refinement-manifest.json",
);
export const REFINED_MACHINE_REPORT_PATH = path.join(
  PIPELINE_ROOT,
  "qa/refined-machine-report.json",
);
export const REFINED_CONTACT_MANIFEST_PATH = path.join(
  PIPELINE_ROOT,
  "qa/refined-contact-sheets/manifest.json",
);
export const REFINED_REVIEW_PATH = path.join(
  PIPELINE_ROOT,
  "reviews/refined-human-review.json",
);
export const SOURCE_RELEASE_RECEIPT_PATH = path.join(
  PIPELINE_ROOT,
  "release/source-release-receipt.json",
);
export const REFINEMENT_RELEASE_RECEIPT_PATH = path.join(
  PIPELINE_ROOT,
  "release/refinement-release-receipt.json",
);
export const PALETTE_MANIFEST_PATH = path.join(
  PIPELINE_ROOT,
  "release/palette-manifest.json",
);
export const HEADER_BINDING_PATH = path.join(
  PIPELINE_ROOT,
  "release/route-header-bindings.json",
);
export const IMAGE_RELEASE_PATH = path.join(
  PIPELINE_ROOT,
  "release/image-release.json",
);
export const RUNTIME_RELEASE_PATH = path.join(
  PROJECT_ROOT,
  "src/data/image-release.generated.json",
);

export const EXPECTED_PLAN_FILE_SHA256 =
  "7217c6dc1dd98a17b0caec86da68e6c16c9b726898a3c9f971137db3298bd2fa";
export const EXPECTED_CAMPAIGN_FILE_SHA256 =
  "72668e5073767083d0a82eb7402330ae22aab2376d5de9565e8201a3debe9cf2";
export const CAMPAIGN_ID = "massage-love-image-campaign-v1";
export const RUNTIME_LANES = 5;
export const MAX_WAIT_CALLS = 12;
export const EXPECTED_JOB_COUNT = 324;
export const EXPECTED_REGIONAL_COUNT = 323;
export const EXPECTED_ROUTE_COUNT = 1291;
export const PROVIDER_EMPTY_REFERENCE_DIGEST =
  "sha256:7c4bde9f12a2629875105d124e5d72b48e9487619f060111dc4fe49d6c3f69a9";
export const TOP_PALETTE_FRACTION = 0.18;
export const CROSS_PLATFORM_MAX_DHASH_DISTANCE = 6;
export const CROSS_PLATFORM_MAX_PHASH_DISTANCE = 8;

export const PROFILES = Object.freeze([
  Object.freeze({
    profile: "desktop",
    width: 2048,
    height: 922,
    focusX: 0.5,
    quality: 90,
  }),
  Object.freeze({
    profile: "tablet",
    width: 1536,
    height: 1024,
    focusX: 0.58,
    quality: 90,
  }),
  Object.freeze({
    profile: "mobile",
    width: 1024,
    height: 2048,
    focusX: 0.69,
    quality: 90,
  }),
]);

export class PipelineError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = "PipelineError";
    this.code = code;
    this.details = details;
  }
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function canonicalSha256(value) {
  return sha256(Buffer.from(canonicalJson(value)));
}

export function providerBindingForJob(job) {
  if (
    !job ||
    typeof job.promptSha256 !== "string" ||
    !/^[0-9a-f]{64}$/.test(job.promptSha256) ||
    typeof job.outputNamespace !== "string"
  ) {
    throw new PipelineError(
      "PROVIDER_BINDING_INPUT_INVALID",
      "provider binding requires an exact prompt digest and output namespace",
    );
  }
  const promptDigest = `sha256:${job.promptSha256}`;
  const requestDigest = `sha256:${sha256(
    JSON.stringify({
      version: 1,
      prompt_digest: promptDigest,
      output_subdirectory: job.outputNamespace,
      reference_digest: PROVIDER_EMPTY_REFERENCE_DIGEST,
    }),
  )}`;
  return Object.freeze({
    promptDigest,
    requestDigest,
    referenceDigest: PROVIDER_EMPTY_REFERENCE_DIGEST,
    referenceCount: 0,
    outputSubdirectory: job.outputNamespace,
  });
}

export function prettyJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function isSha256(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

export function isPHash(value) {
  return typeof value === "string" && /^[a-f0-9]{16}$/.test(value);
}

export function isDhash(value) {
  return typeof value === "string" && /^[a-f0-9]{16}$/.test(value);
}

export function isInside(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
  );
}

export function requireSafeRelative(value, label) {
  if (
    typeof value !== "string" ||
    !value ||
    path.isAbsolute(value) ||
    value.split(/[\\/]/).includes("..")
  ) {
    throw new PipelineError("UNSAFE_RELATIVE_PATH", `${label} must be a safe relative path`);
  }
  return value;
}

export async function readRegularFile(filePath) {
  const absolute = path.resolve(filePath);
  const beforeLink = await lstat(absolute);
  if (beforeLink.isSymbolicLink() || !beforeLink.isFile()) {
    throw new PipelineError("FILE_NOT_REGULAR", `${absolute} must be a regular non-symlink file`);
  }
  const handle = await open(absolute, "r");
  try {
    const before = await handle.stat();
    const bytes = await handle.readFile();
    const after = await handle.stat();
    if (
      before.dev !== after.dev ||
      before.ino !== after.ino ||
      before.size !== after.size ||
      bytes.length !== before.size
    ) {
      throw new PipelineError("FILE_CHANGED_DURING_READ", `${absolute} changed during read`);
    }
    return {
      path: absolute,
      bytes,
      byteLength: bytes.length,
      sha256: sha256(bytes),
      stat: after,
    };
  } finally {
    await handle.close();
  }
}

export async function readJsonFile(filePath) {
  const file = await readRegularFile(filePath);
  try {
    return { ...file, value: JSON.parse(file.bytes.toString("utf8")) };
  } catch (error) {
    throw new PipelineError("JSON_INVALID", `${file.path} is not valid JSON`, {
      message: error?.message ?? String(error),
    });
  }
}

async function fsyncParent(filePath) {
  const handle = await open(path.dirname(filePath), "r");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

export async function atomicReplaceJson(filePath, value) {
  const absolute = path.resolve(filePath);
  const parent = path.dirname(absolute);
  await mkdir(parent, { recursive: true, mode: 0o700 });
  const temp = path.join(
    parent,
    `.${path.basename(absolute)}.tmp-${process.pid}-${Date.now()}`,
  );
  const handle = await open(temp, "wx", 0o600);
  try {
    await handle.writeFile(prettyJson(value), "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await chmod(temp, 0o600);
  await rename(temp, absolute);
  await fsyncParent(absolute);
}

export async function atomicNoClobberBuffer(filePath, bytes, mode = 0o600) {
  const absolute = path.resolve(filePath);
  const parent = path.dirname(absolute);
  await mkdir(parent, { recursive: true, mode: 0o700 });
  try {
    const existing = await readRegularFile(absolute);
    if (Buffer.compare(existing.bytes, bytes) !== 0) {
      throw new PipelineError(
        "NO_CLOBBER_CONFLICT",
        `${absolute} already exists with different bytes`,
      );
    }
    return { path: absolute, sha256: existing.sha256, bytes: existing.byteLength, reused: true };
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  const temp = path.join(
    parent,
    `.${path.basename(absolute)}.tmp-${process.pid}-${Date.now()}`,
  );
  const handle = await open(temp, "wx", mode);
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
  await chmod(temp, mode);
  try {
    await link(temp, absolute);
    await unlink(temp);
  } catch (error) {
    await rm(temp, { force: true });
    if (error?.code !== "EEXIST") throw error;
    const existing = await readRegularFile(absolute);
    if (Buffer.compare(existing.bytes, bytes) !== 0) {
      throw new PipelineError(
        "NO_CLOBBER_RACE_CONFLICT",
        `${absolute} appeared with different bytes`,
      );
    }
    return { path: absolute, sha256: existing.sha256, bytes: existing.byteLength, reused: true };
  }
  await fsyncParent(absolute);
  return { path: absolute, sha256: sha256(bytes), bytes: bytes.length, reused: false };
}

export async function atomicNoClobberJson(filePath, value) {
  return atomicNoClobberBuffer(filePath, Buffer.from(prettyJson(value)));
}

export async function loadAndValidateContracts() {
  const [planFile, campaignFile] = await Promise.all([
    readJsonFile(PLAN_PATH),
    readJsonFile(CAMPAIGN_PATH),
  ]);
  if (planFile.sha256 !== EXPECTED_PLAN_FILE_SHA256) {
    throw new PipelineError("PLAN_FILE_SHA_MISMATCH", "generation plan bytes changed", {
      expected: EXPECTED_PLAN_FILE_SHA256,
      actual: planFile.sha256,
    });
  }
  if (campaignFile.sha256 !== EXPECTED_CAMPAIGN_FILE_SHA256) {
    throw new PipelineError("CAMPAIGN_FILE_SHA_MISMATCH", "campaign contract bytes changed", {
      expected: EXPECTED_CAMPAIGN_FILE_SHA256,
      actual: campaignFile.sha256,
    });
  }
  const plan = planFile.value;
  const campaign = campaignFile.value;
  if (
    plan?.schemaVersion !== "massage-love-image-generation-plan/v1" ||
    plan?.platformId !== "massage-love" ||
    plan?.status !== "READY_FOR_COORDINATED_RUN" ||
    plan?.runtimeLanes !== RUNTIME_LANES ||
    plan?.counts?.jobs !== EXPECTED_JOB_COUNT ||
    plan?.counts?.regional !== EXPECTED_REGIONAL_COUNT ||
    plan?.counts?.home !== 1 ||
    plan?.counts?.waves !== 65 ||
    !Array.isArray(plan.jobs) ||
    plan.jobs.length !== EXPECTED_JOB_COUNT ||
    !Array.isArray(plan.waves) ||
    plan.waves.length !== 65
  ) {
    throw new PipelineError("PLAN_CONTRACT_INVALID", "generation plan shape is invalid");
  }
  const jobIds = new Set();
  const imageIds = new Set();
  const outputNamespaces = new Set();
  const promptHashes = new Set();
  const providerRequestDigests = new Set();
  for (const [index, job] of plan.jobs.entries()) {
    if (
      job?.order !== index + 1 ||
      typeof job.jobId !== "string" ||
      typeof job.imageId !== "string" ||
      typeof job.prompt !== "string" ||
      sha256(job.prompt) !== job.promptSha256 ||
      !Array.isArray(job.referenceImages) ||
      job.referenceImages.length !== 0
    ) {
      throw new PipelineError("PLAN_JOB_INVALID", `plan job ${index + 1} is invalid`);
    }
    requireSafeRelative(job.outputNamespace, `jobs[${index}].outputNamespace`);
    jobIds.add(job.jobId);
    imageIds.add(job.imageId);
    outputNamespaces.add(job.outputNamespace);
    promptHashes.add(job.promptSha256);
    providerRequestDigests.add(providerBindingForJob(job).requestDigest);
  }
  if (
    jobIds.size !== EXPECTED_JOB_COUNT ||
    imageIds.size !== EXPECTED_JOB_COUNT ||
    outputNamespaces.size !== EXPECTED_JOB_COUNT ||
    promptHashes.size !== EXPECTED_JOB_COUNT ||
    providerRequestDigests.size !== EXPECTED_JOB_COUNT ||
    plan.jobs[0].imageId !== "MLV-HOME-001"
  ) {
    throw new PipelineError("PLAN_IDENTITY_DUPLICATE", "plan identities must be unique");
  }
  const projected = plan.waves.flatMap((wave) =>
    wave.lanes.map((lane) => ({ wave: wave.wave, ...lane })),
  );
  if (projected.length !== EXPECTED_JOB_COUNT) {
    throw new PipelineError("PLAN_WAVE_CARDINALITY", "waves do not cover 324 jobs");
  }
  for (const [index, item] of projected.entries()) {
    const job = plan.jobs[index];
    const expectedLane = (index % RUNTIME_LANES) + 1;
    const expectedWave = Math.floor(index / RUNTIME_LANES) + 1;
    if (
      item.wave !== expectedWave ||
      item.lane !== expectedLane ||
      item.jobId !== job.jobId ||
      item.imageId !== job.imageId
    ) {
      throw new PipelineError("PLAN_WAVE_BINDING", `wave binding ${index + 1} is invalid`);
    }
  }
  if (
    campaign?.schemaVersion !== "massage-love-region-hero-campaign/v1" ||
    campaign?.platformId !== "massage-love" ||
    campaign?.status !== "PLANNED_NO_ASSETS" ||
    campaign?.counts?.routes !== EXPECTED_ROUTE_COUNT ||
    campaign?.counts?.regionalImages !== EXPECTED_REGIONAL_COUNT ||
    campaign?.counts?.homeHeroes !== 1 ||
    campaign?.homeHero?.imageId !== "MLV-HOME-001" ||
    campaign.homeHero.exclusiveToRoute !== "/" ||
    campaign.homeHero.allowRegionalReuse !== false ||
    campaign.homeHero.referenceImages?.length !== 0 ||
    !Array.isArray(campaign.regionalImages) ||
    campaign.regionalImages.length !== EXPECTED_REGIONAL_COUNT ||
    !Array.isArray(campaign.assignments) ||
    campaign.assignments.length !== EXPECTED_ROUTE_COUNT
  ) {
    throw new PipelineError("CAMPAIGN_CONTRACT_INVALID", "campaign contract shape is invalid");
  }
  const regionalIds = new Set(campaign.regionalImages.map((image) => image.imageId));
  if (regionalIds.has("MLV-HOME-001") || regionalIds.size !== EXPECTED_REGIONAL_COUNT) {
    throw new PipelineError("HOME_EXCLUSIVITY_INVALID", "home hero leaked into regional assets");
  }
  const usage = new Map();
  const routes = new Set();
  for (const assignment of campaign.assignments) {
    if (
      typeof assignment.route !== "string" ||
      !assignment.route.startsWith("/areas/") ||
      !regionalIds.has(assignment.imageId)
    ) {
      throw new PipelineError("ASSIGNMENT_INVALID", "regional assignment is invalid");
    }
    routes.add(assignment.route);
    usage.set(assignment.imageId, (usage.get(assignment.imageId) ?? 0) + 1);
  }
  if (routes.size !== EXPECTED_ROUTE_COUNT) {
    throw new PipelineError("ASSIGNMENT_ROUTE_DUPLICATE", "regional routes are not unique");
  }
  const distribution = [...usage.values()].reduce(
    (result, count) => ({ ...result, [count]: (result[count] ?? 0) + 1 }),
    {},
  );
  if (distribution[3] !== 1 || distribution[4] !== 322) {
    throw new PipelineError("ASSIGNMENT_REUSE_INVALID", "reuse must be 1x3 plus 322x4");
  }
  return {
    plan,
    campaign,
    planFileSha256: planFile.sha256,
    campaignFileSha256: campaignFile.sha256,
  };
}

export function requestDigest(job) {
  return canonicalSha256({
    clientRequestId: job.jobId,
    outputSubdirectory: job.outputNamespace,
    promptSha256: job.promptSha256,
    referenceCount: 0,
    referenceDigest: canonicalSha256([]),
  });
}

export function createInitialGenerationManifest(contracts) {
  const { plan, planFileSha256, campaignFileSha256 } = contracts;
  return {
    schemaVersion: "massage-love-image-generation-ledger/v1",
    campaignId: CAMPAIGN_ID,
    platformId: "massage-love",
    status: "PLANNED_NO_SUBMISSIONS",
    bindings: {
      planPath: path.relative(PROJECT_ROOT, PLAN_PATH),
      planFileSha256,
      campaignPath: path.relative(PROJECT_ROOT, CAMPAIGN_PATH),
      campaignFileSha256,
    },
    runtimePolicy: {
      lanes: RUNTIME_LANES,
      drainFirst: true,
      maxWaitCallsPerJob: MAX_WAIT_CALLS,
      noReplacementWhilePending: true,
      globalUncertaintyStopsAllNewSubmissions: true,
      exactClientRequestReplayOnly: true,
    },
    providerBindingPolicy: {
      schemaVersion: "meta-ai-text-only-request-binding/v1",
      digestPrefix: "sha256:",
      emptyReferenceDigest: PROVIDER_EMPTY_REFERENCE_DIGEST,
      referenceCount: 0,
      exactStartResponseRequired: true,
    },
    counts: {
      total: EXPECTED_JOB_COUNT,
      planned: EXPECTED_JOB_COUNT,
      active: 0,
      uncertain: 0,
      completed: 0,
      failed: 0,
      generationSubmissions: 0,
    },
    blocked: null,
    providerOutputRoot: null,
    entries: plan.jobs.map((job, index) => ({
      order: job.order,
      wave: Math.floor(index / RUNTIME_LANES) + 1,
      plannedLane: (index % RUNTIME_LANES) + 1,
      imageId: job.imageId,
      jobId: job.jobId,
      clientRequestId: job.jobId,
      promptSha256: job.promptSha256,
      requestDigest: requestDigest(job),
      referenceDigest: canonicalSha256([]),
      referenceCount: 0,
      outputSubdirectory: job.outputNamespace,
      status: "planned",
      startCallCount: 0,
      waitCallCount: 0,
      providerJobId: null,
      providerLaneId: null,
      duplicateRequest: null,
      submissionCommitted: false,
      files: [],
      error: null,
    })),
  };
}

export function recomputeGenerationCounts(manifest) {
  const statuses = manifest.entries.map((entry) => entry.status);
  const activeStates = new Set(["generating", "started_completed", "downloading"]);
  manifest.counts = {
    total: manifest.entries.length,
    planned: statuses.filter((status) => status === "planned").length,
    active: statuses.filter((status) => activeStates.has(status)).length,
    uncertain: statuses.filter((status) => status === "submission_uncertain").length,
    completed: statuses.filter((status) => status === "completed").length,
    failed: statuses.filter((status) => status === "failed").length,
    generationSubmissions: manifest.counts?.generationSubmissions ?? 0,
  };
  return manifest.counts;
}

export function validateGenerationManifest(contracts, manifest) {
  const expected = createInitialGenerationManifest(contracts);
  const allowedStatuses = new Set([
    "planned",
    "starting",
    "generating",
    "started_completed",
    "downloading",
    "submission_uncertain",
    "completed",
    "failed",
  ]);
  const knownProviderJobs = new Set();
  if (
    manifest?.schemaVersion !== expected.schemaVersion ||
    manifest?.campaignId !== CAMPAIGN_ID ||
    manifest?.platformId !== "massage-love" ||
    canonicalJson(manifest.bindings) !== canonicalJson(expected.bindings) ||
    canonicalJson(manifest.runtimePolicy) !== canonicalJson(expected.runtimePolicy) ||
    canonicalJson(manifest.providerBindingPolicy) !==
      canonicalJson(expected.providerBindingPolicy) ||
    !Array.isArray(manifest.entries) ||
    manifest.entries.length !== EXPECTED_JOB_COUNT
  ) {
    throw new PipelineError("GENERATION_MANIFEST_INVALID", "generation ledger binding is invalid");
  }
  if (
    manifest.providerOutputRoot !== null &&
    manifest.providerOutputRoot !== undefined &&
    (typeof manifest.providerOutputRoot !== "string" ||
      !path.isAbsolute(manifest.providerOutputRoot))
  ) {
    throw new PipelineError(
      "GENERATION_OUTPUT_ROOT_INVALID",
      "provider output root must be null or an absolute path",
    );
  }
  for (const [index, entry] of manifest.entries.entries()) {
    const pinned = expected.entries[index];
    for (const key of [
      "order",
      "wave",
      "plannedLane",
      "imageId",
      "jobId",
      "clientRequestId",
      "promptSha256",
      "requestDigest",
      "referenceDigest",
      "referenceCount",
      "outputSubdirectory",
    ]) {
      if (canonicalJson(entry[key]) !== canonicalJson(pinned[key])) {
        throw new PipelineError(
          "GENERATION_ENTRY_BINDING_INVALID",
          `${entry?.imageId ?? index} ${key} drifted from the immutable plan`,
        );
      }
    }
    if (
      !allowedStatuses.has(entry.status) ||
      !Number.isSafeInteger(entry.startCallCount) ||
      entry.startCallCount < 0 ||
      entry.startCallCount > 1 ||
      !Number.isSafeInteger(entry.waitCallCount) ||
      entry.waitCallCount < 0 ||
      typeof entry.submissionCommitted !== "boolean" ||
      !Array.isArray(entry.files)
    ) {
      throw new PipelineError(
        "GENERATION_ENTRY_STATE_INVALID",
        `${entry.imageId} has an invalid durable state`,
      );
    }
    if (
      entry.status === "planned" &&
      (entry.startCallCount !== 0 ||
        entry.waitCallCount !== 0 ||
        entry.providerJobId !== null ||
        entry.providerLaneId !== null ||
        entry.submissionCommitted !== false ||
        entry.files.length !== 0)
    ) {
      throw new PipelineError(
        "PLANNED_ENTRY_DIRTY",
        `${entry.imageId} planned state carries provider evidence`,
      );
    }
    if (entry.status === "completed") {
      if (
        typeof entry.providerJobId !== "string" ||
        typeof entry.providerLaneId !== "string" ||
        !Array.isArray(entry.files) ||
        entry.files.length !== 1 ||
        !isSha256(entry.files[0]?.sha256) ||
        !Number.isSafeInteger(entry.files[0]?.bytes) ||
        entry.files[0].bytes <= 0
      ) {
        throw new PipelineError(
          "COMPLETED_ENTRY_INCOMPLETE",
          `${entry.imageId} completed entry lacks exact provider/file evidence`,
        );
      }
    }
    if (
      ["generating", "started_completed", "downloading"].includes(entry.status) &&
      typeof entry.providerJobId !== "string"
    ) {
      throw new PipelineError("ACTIVE_JOB_BINDING_MISSING", `${entry.imageId} has no provider job id`);
    }
    if (typeof entry.providerJobId === "string") {
      if (knownProviderJobs.has(entry.providerJobId)) {
        throw new PipelineError(
          "PROVIDER_JOB_REUSED",
          `${entry.imageId} reuses a provider job binding`,
        );
      }
      knownProviderJobs.add(entry.providerJobId);
    }
    if (entry.submissionCommitted && typeof entry.providerJobId !== "string") {
      throw new PipelineError(
        "COMMITTED_SUBMISSION_UNBOUND",
        `${entry.imageId} committed submission lacks a provider job`,
      );
    }
    if (entry.waitCallCount > MAX_WAIT_CALLS) {
      throw new PipelineError("WAIT_BOUND_EXCEEDED", `${entry.imageId} exceeded 12 waits`);
    }
  }
  if (
    manifest.entries.some((entry) =>
      ["generating", "started_completed", "downloading", "completed"].includes(entry.status),
    ) &&
    (typeof manifest.providerOutputRoot !== "string" ||
      !path.isAbsolute(manifest.providerOutputRoot))
  ) {
    throw new PipelineError(
      "GENERATION_OUTPUT_ROOT_MISSING",
      "active or completed sources require a bound provider output root",
    );
  }
  const actualSubmissions = manifest.entries.filter(
    (entry) => entry.submissionCommitted === true,
  ).length;
  if ((manifest.counts?.generationSubmissions ?? 0) !== actualSubmissions) {
    throw new PipelineError(
      "SUBMISSION_COUNT_INVALID",
      "generation submission count does not match durable entries",
    );
  }
  recomputeGenerationCounts(manifest);
  return manifest;
}

const PHASH_SAMPLE_SIZE = 32;
const PHASH_LOW_FREQUENCY_SIZE = 8;
const PHASH_COSINES = Object.freeze(
  Array.from({ length: PHASH_LOW_FREQUENCY_SIZE }, (_, frequency) =>
    Object.freeze(
      Array.from({ length: PHASH_SAMPLE_SIZE }, (_, position) =>
        Math.cos(
          ((2 * position + 1) * frequency * Math.PI) /
            (2 * PHASH_SAMPLE_SIZE),
        ),
      ),
    ),
  ),
);

export async function dhash64(input) {
  const { data, info } = await sharp(input, { failOn: "warning" })
    .rotate()
    .greyscale()
    .resize(9, 8, { fit: "fill", kernel: "lanczos3" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.width !== 9 || info.height !== 8 || info.channels !== 1) {
    throw new PipelineError("DHASH_DECODE_INVALID", "dHash decode shape is invalid");
  }
  let value = 0n;
  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      value =
        (value << 1n) |
        BigInt(data[row * 9 + column] > data[row * 9 + column + 1]);
    }
  }
  return value.toString(16).padStart(16, "0");
}

export async function phash64(input) {
  const { data, info } = await sharp(input, { failOn: "warning" })
    .rotate()
    .greyscale()
    .resize(PHASH_SAMPLE_SIZE, PHASH_SAMPLE_SIZE, {
      fit: "fill",
      kernel: "lanczos3",
    })
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (
    info.width !== PHASH_SAMPLE_SIZE ||
    info.height !== PHASH_SAMPLE_SIZE ||
    info.channels !== 1
  ) {
    throw new PipelineError("PHASH_DECODE_INVALID", "pHash decode shape is invalid");
  }
  const coefficients = [];
  for (let vertical = 0; vertical < PHASH_LOW_FREQUENCY_SIZE; vertical += 1) {
    for (let horizontal = 0; horizontal < PHASH_LOW_FREQUENCY_SIZE; horizontal += 1) {
      let sum = 0;
      for (let y = 0; y < PHASH_SAMPLE_SIZE; y += 1) {
        const verticalCosine = PHASH_COSINES[vertical][y];
        for (let x = 0; x < PHASH_SAMPLE_SIZE; x += 1) {
          sum +=
            data[y * PHASH_SAMPLE_SIZE + x] *
            PHASH_COSINES[horizontal][x] *
            verticalCosine;
        }
      }
      const horizontalScale = horizontal === 0 ? Math.SQRT1_2 : 1;
      const verticalScale = vertical === 0 ? Math.SQRT1_2 : 1;
      coefficients.push(sum * horizontalScale * verticalScale);
    }
  }
  const lowFrequencyWithoutDc = coefficients.slice(1).sort((left, right) => left - right);
  const median = lowFrequencyWithoutDc[Math.floor(lowFrequencyWithoutDc.length / 2)];
  let value = 0n;
  for (const coefficient of coefficients) {
    value = (value << 1n) | BigInt(coefficient >= median);
  }
  return value.toString(16).padStart(16, "0");
}

export function hammingPHash(left, right) {
  if (!isPHash(left) || !isPHash(right)) {
    throw new PipelineError("PHASH_INVALID", "pHash must be 16 lowercase hex characters");
  }
  let value = BigInt(`0x${left}`) ^ BigInt(`0x${right}`);
  let count = 0;
  while (value) {
    count += Number(value & 1n);
    value >>= 1n;
  }
  return count;
}

export function hammingDhash(left, right) {
  if (!isDhash(left) || !isDhash(right)) {
    throw new PipelineError("DHASH_INVALID", "dHash must be 16 lowercase hex characters");
  }
  let value = BigInt(`0x${left}`) ^ BigInt(`0x${right}`);
  let count = 0;
  while (value) {
    count += Number(value & 1n);
    value >>= 1n;
  }
  return count;
}

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function toHex([red, green, blue]) {
  return `#${[red, green, blue]
    .map((channel) => clampByte(channel).toString(16).padStart(2, "0"))
    .join("")}`;
}

function rgba(hex, alpha) {
  const value = hex.slice(1);
  const channels = [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
  return `rgba(${channels.join(", ")}, ${alpha.toFixed(2)})`;
}

export async function extractTopPalette(input, sourceSha256) {
  const metadata = await sharp(input, { failOn: "warning" }).metadata();
  if (!metadata.width || !metadata.height) {
    throw new PipelineError("PALETTE_SOURCE_INVALID", "palette source dimensions missing");
  }
  const topHeight = Math.max(1, Math.floor(metadata.height * TOP_PALETTE_FRACTION));
  const { data, info } = await sharp(input, { failOn: "warning" })
    .extract({ left: 0, top: 0, width: metadata.width, height: topHeight })
    .resize(96, 18, { fit: "fill", kernel: "lanczos3" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const buckets = new Map();
  let luminanceTotal = 0;
  for (let offset = 0; offset < data.length; offset += info.channels) {
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const key = `${red >> 4}-${green >> 4}-${blue >> 4}`;
    const current = buckets.get(key) ?? { count: 0, red: 0, green: 0, blue: 0 };
    current.count += 1;
    current.red += red;
    current.green += green;
    current.blue += blue;
    buckets.set(key, current);
    luminanceTotal += 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  }
  const ranked = [...buckets.values()]
    .sort((left, right) => right.count - left.count)
    .slice(0, 3)
    .map((bucket) =>
      toHex([
        bucket.red / bucket.count,
        bucket.green / bucket.count,
        bucket.blue / bucket.count,
      ]),
    );
  while (ranked.length < 3) ranked.push(ranked.at(-1) ?? "#321a20");
  const style = {
    "--route-header-start": rgba(ranked[0], 0.94),
    "--route-header-mid": rgba(ranked[1], 0.91),
    "--route-header-end": rgba(ranked[2], 0.88),
    "--route-header-border": rgba(ranked[2], 0.32),
  };
  return {
    algorithm: "top-18-percent-quantized-rgb-v1",
    sourceProfile: "desktop",
    sourceSha256,
    sample: {
      topFraction: TOP_PALETTE_FRACTION,
      sourceWidth: metadata.width,
      sourceHeight: metadata.height,
      sampledWidth: info.width,
      sampledHeight: info.height,
    },
    dominantHex: ranked[0],
    gradientStops: ranked,
    averageLuminance: Number((luminanceTotal / (data.length / info.channels) / 255).toFixed(6)),
    style,
  };
}

export function headerBinding({ assetId, route, palette }) {
  const paletteSha256 = canonicalSha256(palette);
  const style = palette.style;
  return {
    paletteSha256,
    bindingSha256: canonicalSha256({ assetId, palette, route, style }),
    style,
  };
}

export async function imageMetadata(input) {
  const metadata = await sharp(input, { failOn: "warning", limitInputPixels: 100_000_000 })
    .rotate()
    .metadata();
  return {
    format: metadata.format,
    width: metadata.width,
    height: metadata.height,
    channels: metadata.channels,
    orientation: metadata.orientation ?? 1,
    space: metadata.space,
  };
}

export function sourceImageChecks(metadata) {
  const ratio = metadata.width / metadata.height;
  return {
    decodable: Boolean(metadata.width && metadata.height && metadata.format),
    supportedFormat: ["jpeg", "png", "webp"].includes(metadata.format),
    minimumDimensions: metadata.width >= 1536 && metadata.height >= 864,
    landscape16x9: Math.abs(ratio - 16 / 9) <= 0.012,
    orientationNormalized: metadata.orientation === 1,
  };
}

export function allChecksPass(checks) {
  return Object.values(checks).every((value) => value === true);
}

export async function verifyFileRecord(record, { allowedRoot = null } = {}) {
  if (!record || typeof record.path !== "string" || !path.isAbsolute(record.path)) {
    throw new PipelineError("FILE_RECORD_PATH_INVALID", "file record path must be absolute");
  }
  const actual = await realpath(record.path);
  if (allowedRoot && !isInside(allowedRoot, actual)) {
    throw new PipelineError("FILE_RECORD_ROOT_ESCAPE", `${actual} escaped ${allowedRoot}`);
  }
  const file = await readRegularFile(actual);
  if (file.sha256 !== record.sha256 || file.byteLength !== record.bytes) {
    throw new PipelineError("FILE_RECORD_DIGEST_INVALID", `${actual} digest/size mismatch`);
  }
  return file;
}

export async function fileExists(filePath) {
  try {
    return (await stat(filePath)).isFile();
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}
