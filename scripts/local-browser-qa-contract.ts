type JsonRecord = Record<string, unknown>;

export type LocalBrowserQaInputs = {
  corpusSha256: string;
  qualitySha256: string;
  semanticSha256: string;
  semanticCaseSetSha256: string;
};

const REQUIRED_CASES = [
  ["/areas/seoul", 320, 844],
  ["/areas/seoul", 390, 844],
  ["/areas/seoul", 1440, 900],
  ["/areas/seoul/%EA%B0%95%EB%82%A8%EA%B5%AC", 320, 844],
  ["/areas/seoul/%EA%B0%95%EB%82%A8%EA%B5%AC", 390, 844],
  ["/areas/seoul/%EA%B0%95%EB%82%A8%EA%B5%AC", 1440, 900],
  [
    "/areas/seoul/%EA%B0%95%EB%82%A8%EA%B5%AC/%EC%97%AD%EC%82%BC%EB%8F%99",
    320,
    844,
  ],
  [
    "/areas/seoul/%EA%B0%95%EB%82%A8%EA%B5%AC/%EC%97%AD%EC%82%BC%EB%8F%99",
    390,
    844,
  ],
  [
    "/areas/seoul/%EA%B0%95%EB%82%A8%EA%B5%AC/%EC%97%AD%EC%82%BC%EB%8F%99",
    1440,
    900,
  ],
] as const;

export function validateLocalChromiumReceipt(
  value: unknown,
  inputs: LocalBrowserQaInputs,
): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("MASSAGE_LOVE_LOCAL_CHROMIUM_RECEIPT_NOT_OBJECT");
  }
  const receipt = value as JsonRecord;
  const claims = receipt.claims as JsonRecord | undefined;
  const bindings = receipt.bindings as JsonRecord | undefined;
  const corpus = bindings?.corpus as JsonRecord | undefined;
  const quality = bindings?.quality as JsonRecord | undefined;
  const semantic = bindings?.semantic as JsonRecord | undefined;
  const matrix = receipt.matrix as JsonRecord | undefined;
  const reproducibility = receipt.reproducibility as JsonRecord | undefined;
  const images = receipt.images as JsonRecord | undefined;
  const summary = receipt.summary as JsonRecord | undefined;
  const cases = receipt.cases as JsonRecord[] | undefined;
  if (
    receipt.schemaVersion !== "massage-love-local-chromium-functional-qa/v1" ||
    receipt.status !== "PASS_LOCAL_FUNCTIONAL_QA" ||
    receipt.evidenceLane !== "LOCAL_CHROMIUM_PLAYWRIGHT_FUNCTIONAL_QA" ||
    receipt.releaseImpact !== "FAST_CANDIDATE_EVIDENCE_ONLY" ||
    claims?.inAppBrowser !== false ||
    claims?.humanReview !== false ||
    claims?.humanVisualReview !== false ||
    claims?.publicGo !== false ||
    corpus?.sha256 !== inputs.corpusSha256 ||
    quality?.sha256 !== inputs.qualitySha256 ||
    semantic?.sha256 !== inputs.semanticSha256 ||
    semantic?.semanticCaseSetSha256 !== inputs.semanticCaseSetSha256 ||
    matrix?.requiredCases !== 9 ||
    matrix?.completedCases !== 9 ||
    reproducibility?.network !== "owned random-port 127.0.0.1 server only" ||
    reproducibility?.screenshotsOrImageFilesCreated !== false ||
    reproducibility?.recordedPortOrProcessId !== false ||
    reproducibility?.ownedBrowserAndServerStoppedBeforeReceiptWrite !== true ||
    images?.state !== "PLANNED_NO_ASSETS" ||
    images?.screenshotsCreated !== 0 ||
    !Array.isArray(cases) ||
    cases.length !== 9
  ) {
    throw new Error("MASSAGE_LOVE_LOCAL_CHROMIUM_RECEIPT_LABEL_OR_BINDING_INVALID");
  }
  const expectedKeys = new Set(
    REQUIRED_CASES.map(([route, width, height]) => `${route}\u0000${width}x${height}`),
  );
  const actualKeys = new Set<string>();
  for (const entry of cases) {
    const viewport = entry.viewport as JsonRecord | undefined;
    const assertions = entry.assertions as JsonRecord | undefined;
    const key = `${String(entry.route)}\u0000${String(viewport?.width)}x${String(viewport?.height)}`;
    actualKeys.add(key);
    if (
      entry.status !== "PASS" ||
      !assertions ||
      Object.values(assertions).some((result) => result !== true)
    ) {
      throw new Error(`MASSAGE_LOVE_LOCAL_CHROMIUM_CASE_INVALID:${key}`);
    }
  }
  if (
    actualKeys.size !== expectedKeys.size ||
    [...expectedKeys].some((key) => !actualKeys.has(key))
  ) {
    throw new Error("MASSAGE_LOVE_LOCAL_CHROMIUM_MATRIX_INVALID");
  }
  if (
    !summary ||
    Object.values(summary).some((count) => count !== 0)
  ) {
    throw new Error("MASSAGE_LOVE_LOCAL_CHROMIUM_SUMMARY_NOT_ZERO");
  }
}
