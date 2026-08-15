export const LOVE_V9_NORMATIVE_CHAIN = {
  semanticReceiptSha256:
    "fa441ac9f82aeae1223d89e69105a52ae81c9bca5858f0747f6125d5a92f97ae",
  semanticCaseSetSha256:
    "39937241a562a6043df4b6dea58d28ee057c8aed65f343ea3d9a759346cdf997",
  corpusSha256:
    "2cf06fdbeecc24bb55d84947dcab1c4540412a5c8b98554771fbedf73e470620",
  sourceManifestSha256:
    "419a69492a704699c66e948303ee3cad338e72953ff073f8e615dacf7148c747",
  routes: 1298,
} as const;

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label}_MUST_BE_OBJECT`);
  }
  return value as JsonRecord;
}

function assertExactKeys(
  value: JsonRecord,
  expectedKeys: readonly string[],
  label: string,
): void {
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}_SCHEMA_KEYS_INVALID:${JSON.stringify(actual)}`);
  }
}

function assertEqual(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}_INVALID:${JSON.stringify(actual)}`);
  }
}

export function buildNormativeReproducibilitySummary() {
  return {
    schemaVersion: "massage-love-built-semantic-reproducibility/v5",
    status: "PASS",
    releaseAuthority: true,
    policy: {
      authority:
        "required clean-build topology plus semantic receipt, case-set, corpus, source manifest, route count, and their exact variants only",
      nonNormativeDiagnosticsExcluded: true,
      passRequiresTwoIndependentRequiredSets: true,
    },
    topology: {
      cleanBuildsPerRequiredSet: 3,
      physicalPathGroupsPerRequiredSet: 2,
      samePhysicalPathBuildsPerRequiredSet: 2,
      differentPhysicalPathBuildsPerRequiredSet: 1,
      independentRequiredSets: 2,
    },
    normative: LOVE_V9_NORMATIVE_CHAIN,
    variants: {
      normativeSemanticReceiptVariants: 1,
      semanticCaseSetVariants: 1,
      corpusVariants: 1,
      sourceManifestVariants: 1,
      routeCountVariants: 1,
    },
  } as const;
}

export function buildSemanticReleaseLock(normativeSummarySha256: string) {
  return {
    schemaVersion: "massage-love-built-visible-semantic-release-lock/v5",
    status: "LOCKED",
    authority: {
      semanticReceiptSha256: LOVE_V9_NORMATIVE_CHAIN.semanticReceiptSha256,
      normativeReproducibilitySummarySha256: normativeSummarySha256,
    },
    policy: {
      authorityFields:
        "semantic receipt SHA and deterministic reproducibility summary SHA only",
      projectTestsMustFailOnAuthorityDrift: true,
      nonNormativeArtifactsExcluded: true,
    },
  } as const;
}

export function validateNormativeReproducibilitySummary(value: unknown): void {
  const root = asRecord(value, "SUMMARY");
  assertExactKeys(
    root,
    [
      "schemaVersion",
      "status",
      "releaseAuthority",
      "policy",
      "topology",
      "normative",
      "variants",
    ],
    "SUMMARY",
  );
  assertEqual(
    root.schemaVersion,
    "massage-love-built-semantic-reproducibility/v5",
    "SUMMARY_SCHEMA_VERSION",
  );
  assertEqual(root.status, "PASS", "SUMMARY_STATUS");
  assertEqual(root.releaseAuthority, true, "SUMMARY_RELEASE_AUTHORITY");

  const policy = asRecord(root.policy, "SUMMARY_POLICY");
  assertExactKeys(
    policy,
    [
      "authority",
      "nonNormativeDiagnosticsExcluded",
      "passRequiresTwoIndependentRequiredSets",
    ],
    "SUMMARY_POLICY",
  );
  assertEqual(
    policy.authority,
    "required clean-build topology plus semantic receipt, case-set, corpus, source manifest, route count, and their exact variants only",
    "SUMMARY_POLICY_AUTHORITY",
  );
  assertEqual(
    policy.nonNormativeDiagnosticsExcluded,
    true,
    "SUMMARY_POLICY_DIAGNOSTICS_EXCLUDED",
  );
  assertEqual(
    policy.passRequiresTwoIndependentRequiredSets,
    true,
    "SUMMARY_POLICY_TWO_REQUIRED_SETS",
  );

  const topology = asRecord(root.topology, "SUMMARY_TOPOLOGY");
  const expectedTopology = {
    cleanBuildsPerRequiredSet: 3,
    physicalPathGroupsPerRequiredSet: 2,
    samePhysicalPathBuildsPerRequiredSet: 2,
    differentPhysicalPathBuildsPerRequiredSet: 1,
    independentRequiredSets: 2,
  } as const;
  assertExactKeys(topology, Object.keys(expectedTopology), "SUMMARY_TOPOLOGY");
  for (const [key, expected] of Object.entries(expectedTopology)) {
    assertEqual(topology[key], expected, `SUMMARY_TOPOLOGY_${key}`);
  }

  const normative = asRecord(root.normative, "SUMMARY_NORMATIVE");
  assertExactKeys(
    normative,
    [
      "semanticReceiptSha256",
      "semanticCaseSetSha256",
      "corpusSha256",
      "sourceManifestSha256",
      "routes",
    ],
    "SUMMARY_NORMATIVE",
  );
  for (const [key, expected] of Object.entries(LOVE_V9_NORMATIVE_CHAIN)) {
    assertEqual(normative[key], expected, `SUMMARY_NORMATIVE_${key}`);
  }

  const variants = asRecord(root.variants, "SUMMARY_VARIANTS");
  const expectedVariants = {
    normativeSemanticReceiptVariants: 1,
    semanticCaseSetVariants: 1,
    corpusVariants: 1,
    sourceManifestVariants: 1,
    routeCountVariants: 1,
  } as const;
  assertExactKeys(variants, Object.keys(expectedVariants), "SUMMARY_VARIANTS");
  for (const [key, expected] of Object.entries(expectedVariants)) {
    assertEqual(variants[key], expected, `SUMMARY_VARIANTS_${key}`);
  }
}

export function validateSemanticReleaseLock(
  value: unknown,
  normativeSummarySha256: string,
): void {
  const root = asRecord(value, "LOCK");
  assertExactKeys(root, ["schemaVersion", "status", "authority", "policy"], "LOCK");
  assertEqual(
    root.schemaVersion,
    "massage-love-built-visible-semantic-release-lock/v5",
    "LOCK_SCHEMA_VERSION",
  );
  assertEqual(root.status, "LOCKED", "LOCK_STATUS");

  const authority = asRecord(root.authority, "LOCK_AUTHORITY");
  assertExactKeys(
    authority,
    ["semanticReceiptSha256", "normativeReproducibilitySummarySha256"],
    "LOCK_AUTHORITY",
  );
  assertEqual(
    authority.semanticReceiptSha256,
    LOVE_V9_NORMATIVE_CHAIN.semanticReceiptSha256,
    "LOCK_SEMANTIC_RECEIPT",
  );
  assertEqual(
    authority.normativeReproducibilitySummarySha256,
    normativeSummarySha256,
    "LOCK_NORMATIVE_SUMMARY",
  );

  const policy = asRecord(root.policy, "LOCK_POLICY");
  assertExactKeys(
    policy,
    [
      "authorityFields",
      "projectTestsMustFailOnAuthorityDrift",
      "nonNormativeArtifactsExcluded",
    ],
    "LOCK_POLICY",
  );
  assertEqual(
    policy.authorityFields,
    "semantic receipt SHA and deterministic reproducibility summary SHA only",
    "LOCK_POLICY_AUTHORITY_FIELDS",
  );
  assertEqual(
    policy.projectTestsMustFailOnAuthorityDrift,
    true,
    "LOCK_POLICY_DRIFT",
  );
  assertEqual(
    policy.nonNormativeArtifactsExcluded,
    true,
    "LOCK_POLICY_NON_NORMATIVE_ARTIFACTS_EXCLUDED",
  );
}
