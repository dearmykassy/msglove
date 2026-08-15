import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

type BrowserMeasurement = {
  route: string;
  slug: string;
  viewport: { width: number; height: number };
  measured: {
    innerWidth: number;
    innerHeight: number;
    scrollWidth: number;
    bodyTextLength: number;
    h1: string | null;
    h1Count: number;
    headingSkip: boolean;
    addressCheck: boolean;
    localCoordinates: boolean;
    brokenImages: number;
    consoleErrorCount: number;
    telephoneLinkCount: number;
    telephoneCtaLabelsExact: boolean;
    headerPosition: string;
    desktopNavDisplay: string;
    mobileMenuDisplay: string;
    directoryGridColumns: number | null;
  };
  filePath: string;
  browserCaptureBytesBeforePngNormalization: number;
  expectedDirectoryMode: "address-check" | "local-coordinates" | "none";
};

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifactRoot = path.join(projectRoot, "artifacts");

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

async function loadJson(relativePath: string) {
  const absolutePath = path.join(projectRoot, relativePath);
  const bytes = await readFile(absolutePath);
  return {
    relativePath,
    bytes,
    sha256: sha256(bytes),
    value: JSON.parse(bytes.toString("utf8")) as Record<string, unknown>,
  };
}

async function main() {
  const [corpus, quality, built, browserMeasurements] = await Promise.all([
    loadJson("artifacts/content-corpus.json"),
    loadJson("artifacts/content-quality-receipt.json"),
    loadJson("artifacts/built-visible-contract-receipt.v1.json"),
    loadJson("artifacts/browser-qa-browser-measurements.json"),
  ]);
  if (corpus.value.status !== "COMPLETE" || quality.value.status !== "PASS") {
    throw new Error("MASSAGE_LOVE_BROWSER_QA_SOURCE_NOT_COMPLETE");
  }
  if (
    built.value.status !== "PASS" ||
    built.value.schemaVersion !==
      "massage-love-built-visible-semantic-contract-receipt/v4"
  ) {
    throw new Error("MASSAGE_LOVE_BROWSER_QA_BUILT_CONTRACT_NOT_PASS");
  }
  const measurements = browserMeasurements.value.cases as BrowserMeasurement[];
  if (
    typeof browserMeasurements.value.captureMethod !== "string" ||
    !browserMeasurements.value.captureMethod.toLowerCase().includes("in-app browser")
  ) {
    throw new Error("MASSAGE_LOVE_BROWSER_QA_REQUIRES_ACTUAL_IN_APP_BROWSER_CAPTURE");
  }
  if (!Array.isArray(measurements) || measurements.length !== 15) {
    throw new Error("MASSAGE_LOVE_BROWSER_QA_EXPECTS_FIFTEEN_SCREENSHOTS");
  }
  const expectedRoutes = new Map([
    ["/areas/seoul", "local-coordinates"],
    ["/areas/seoul/%EA%B0%95%EB%82%A8%EA%B5%AC", "local-coordinates"],
    [
      "/areas/seoul/%EA%B0%95%EB%82%A8%EA%B5%AC/%EC%97%AD%EC%82%BC%EB%8F%99",
      "address-check",
    ],
    ["/love-select/", "none"],
    ["/evening-note/", "none"],
  ] as const);
  const expectedViewports = new Set(["320x844", "390x844", "1440x900"]);
  const routeViewportKeys = new Set(
    measurements.map(
      (entry) => `${entry.route}\0${entry.viewport.width}x${entry.viewport.height}`,
    ),
  );
  if (
    routeViewportKeys.size !== 15 ||
    [...expectedRoutes].some(([route, mode]) =>
      [...expectedViewports].some(
        (viewport) => !routeViewportKeys.has(`${route}\0${viewport}`),
      ) ||
      measurements.some(
        (entry) => entry.route === route && entry.expectedDirectoryMode !== mode,
      ),
    )
  ) {
    throw new Error("MASSAGE_LOVE_BROWSER_QA_ROUTE_VIEWPORT_MATRIX_INVALID");
  }
  const builtCases = new Map(
    (built.value.cases as Array<Record<string, unknown>>).map((entry) => [
      entry.route as string,
      entry,
    ]),
  );
  const sourceContracts = new Map(
    (corpus.value.routeVisibleContracts as Array<Record<string, unknown>>).map((entry) => [
      entry.route as string,
      entry,
    ]),
  );

  const screenshotCases = [];
  for (const measurement of measurements) {
    const screenshotPath = path.resolve(measurement.filePath);
    if (!screenshotPath.startsWith(`${path.join(artifactRoot, "browser-qa")}${path.sep}`)) {
      throw new Error(`MASSAGE_LOVE_BROWSER_QA_PATH_OUTSIDE_ARTIFACTS:${screenshotPath}`);
    }
    const capturedBytes = await readFile(screenshotPath);
    const capturedMetadata = await sharp(capturedBytes).metadata();
    const bytes = capturedMetadata.format === "png"
      ? capturedBytes
      : await sharp(capturedBytes).png({ compressionLevel: 9 }).toBuffer();
    if (capturedMetadata.format !== "png") await writeFile(screenshotPath, bytes);
    const metadata = await sharp(bytes).metadata();
    const magicHex = bytes.subarray(0, 8).toString("hex");
    const builtCase = builtCases.get(measurement.route);
    const sourceContract = sourceContracts.get(measurement.route);
    if (!builtCase || !sourceContract) {
      throw new Error(`MASSAGE_LOVE_BROWSER_QA_ROUTE_CONTRACT_MISSING:${measurement.route}`);
    }
    const pageType = sourceContract.pageType as string;
    const kindAwareDirectory =
      measurement.expectedDirectoryMode === "address-check"
        ? measurement.measured.addressCheck && !measurement.measured.localCoordinates
        : measurement.expectedDirectoryMode === "local-coordinates"
          ? !measurement.measured.addressCheck && measurement.measured.localCoordinates
          : !measurement.measured.addressCheck && !measurement.measured.localCoordinates;
    const assertions = {
      pngMagic: magicHex === "89504e470d0a1a0a",
      pngFormat: metadata.format === "png",
      pngDimensions:
        metadata.width === measurement.viewport.width &&
        metadata.height === measurement.viewport.height,
      browserViewport:
        measurement.measured.innerWidth === measurement.viewport.width &&
        measurement.measured.innerHeight === measurement.viewport.height,
      horizontalOverflow: measurement.measured.scrollWidth > measurement.viewport.width,
      substantiveBody:
        measurement.measured.bodyTextLength > (pageType === "fixed-page" ? 500 : 1000) &&
        Boolean(measurement.measured.h1),
      kindAwareDirectory,
      telephoneCtaContract:
        measurement.measured.telephoneCtaLabelsExact &&
        measurement.measured.telephoneLinkCount ===
          (pageType.startsWith("region-") ? 4 : 3),
      stickyHeader: measurement.measured.headerPosition === "sticky",
      responsiveNavigation:
        measurement.viewport.width <= 390
          ? measurement.measured.desktopNavDisplay === "none" &&
            measurement.measured.mobileMenuDisplay === "block"
          : measurement.measured.desktopNavDisplay === "flex" &&
            measurement.measured.mobileMenuDisplay === "none",
      responsiveDirectoryColumns:
        measurement.expectedDirectoryMode === "local-coordinates"
          ? measurement.measured.directoryGridColumns ===
            (measurement.viewport.width <= 390 ? 2 : 4)
          : measurement.measured.directoryGridColumns === null,
      headingHierarchy:
        measurement.measured.h1Count === 1 && !measurement.measured.headingSkip,
      cleanRuntime:
        measurement.measured.brokenImages === 0 &&
        measurement.measured.consoleErrorCount === 0,
      builtDomBidirectionalExact: builtCase.status === "PASS",
    };
    const pass =
      assertions.pngMagic &&
      assertions.pngFormat &&
      assertions.pngDimensions &&
      assertions.browserViewport &&
      !assertions.horizontalOverflow &&
      assertions.substantiveBody &&
      assertions.kindAwareDirectory &&
      assertions.telephoneCtaContract &&
      assertions.stickyHeader &&
      assertions.responsiveNavigation &&
      assertions.responsiveDirectoryColumns &&
      assertions.headingHierarchy &&
      assertions.cleanRuntime &&
      assertions.builtDomBidirectionalExact;
    screenshotCases.push({
      route: measurement.route,
      pageType,
      declaredViewport: measurement.viewport,
      browserMeasurement: measurement.measured,
      screenshot: path.relative(artifactRoot, screenshotPath),
      png: {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        magicHex,
        bytes: bytes.length,
        sha256: sha256(bytes),
      },
      bindings: {
        sourceMarkupSha256: sourceContract.sourceMarkupSha256,
        sourceVisibleContractSha256: (
          sourceContract.contract as { digestSha256: string }
        ).digestSha256,
        builtRenderedContractSha256: builtCase.renderedContractSha256,
        normativeBuiltSemanticReceiptSha256: built.sha256,
      },
      assertions,
      status: pass ? "PASS" : "FAIL",
    });
  }

  const fixedDomCases = (built.value.cases as Array<Record<string, unknown>>)
    .filter((entry) => entry.pageType === "fixed-page")
    .map((entry) => ({
      route: entry.route,
      sourceMarkupSha256: entry.sourceMarkupSha256,
      declaredContractSha256: entry.declaredContractSha256,
      renderedContractSha256: entry.renderedContractSha256,
      declaredButNotRenderedOccurrences: entry.declaredButNotRenderedOccurrences,
      renderedButNotDeclaredOccurrences: entry.renderedButNotDeclaredOccurrences,
      status: entry.status,
    }));
  const status =
    screenshotCases.every((entry) => entry.status === "PASS") &&
    fixedDomCases.length === 7 &&
    fixedDomCases.every((entry) => entry.status === "PASS")
      ? "PASS"
      : "FAIL";
  const receipt = {
    schemaVersion: "massage-love-browser-qa/v6",
    testedAt: new Date().toISOString(),
    status,
    releaseAuthority: status === "PASS",
    source: {
      corpus: { path: corpus.relativePath, sha256: corpus.sha256 },
      quality: { path: quality.relativePath, sha256: quality.sha256 },
      builtVisibleSemanticContract: {
        path: built.relativePath,
        sha256: built.sha256,
        semanticCaseSetSha256: (
          built.value.counts as { semanticCaseSetSha256: string }
        ).semanticCaseSetSha256,
      },
      browserMeasurements: {
        path: browserMeasurements.relativePath,
        sha256: browserMeasurements.sha256,
      },
      build: "Next.js 16.3.0 static export, 1302/1302 pages",
    },
    capture: {
      browser: "Codex in-app browser browser-client session",
      viewport:
        "device-pixel-ratio-compensated browser capability overrides yielding exact 320x844, 390x844, and 1440x900 CSS viewports and captures",
      screenshot:
        "viewport-only browser capture decoded and losslessly encoded as PNG with sharp; no scaling, with a copied one-pixel bottom edge only when Chrome fractional-DPR capture is one row short",
      formatGate: "PNG magic bytes and sharp-decoded format",
      dimensionGate: "decoded PNG dimensions exactly equal the browser declaration",
      routeKinds:
        "one root, one hub, one representative leaf, Love Select, and Evening Note at every viewport",
    },
    assertions: {
      screenshotCases: screenshotCases.length,
      fixedBuiltDomCases: fixedDomCases.length,
      failedScreenshots: screenshotCases.filter((entry) => entry.status !== "PASS").length,
      pngFormatMismatch: screenshotCases.filter(
        (entry) => !entry.assertions.pngMagic || !entry.assertions.pngFormat,
      ).length,
      pngDimensionMismatch: screenshotCases.filter(
        (entry) => !entry.assertions.pngDimensions,
      ).length,
      browserViewportMismatch: screenshotCases.filter(
        (entry) => !entry.assertions.browserViewport,
      ).length,
      horizontalOverflow: screenshotCases.filter(
        (entry) => entry.assertions.horizontalOverflow,
      ).length,
      kindAwareDirectoryMismatch: screenshotCases.filter(
        (entry) => !entry.assertions.kindAwareDirectory,
      ).length,
      telephoneCtaMismatch: screenshotCases.filter(
        (entry) => !entry.assertions.telephoneCtaContract,
      ).length,
      stickyHeaderMismatch: screenshotCases.filter(
        (entry) => !entry.assertions.stickyHeader,
      ).length,
      responsiveNavigationMismatch: screenshotCases.filter(
        (entry) => !entry.assertions.responsiveNavigation,
      ).length,
      responsiveDirectoryColumnsMismatch: screenshotCases.filter(
        (entry) => !entry.assertions.responsiveDirectoryColumns,
      ).length,
      headingHierarchyMismatch: screenshotCases.filter(
        (entry) => !entry.assertions.headingHierarchy,
      ).length,
      runtimeMismatch: screenshotCases.filter(
        (entry) => !entry.assertions.cleanRuntime,
      ).length,
      builtDomBidirectionalMismatch: screenshotCases.filter(
        (entry) => !entry.assertions.builtDomBidirectionalExact,
      ).length,
    },
    screenshotCases,
    fixedDomCases,
  };
  const contents = `${JSON.stringify(receipt, null, 2)}\n`;
  await writeFile(
    path.join(artifactRoot, "browser-qa-receipt.v1.json"),
    contents,
    "utf8",
  );
  if (status !== "PASS") {
    throw new Error(`MASSAGE_LOVE_BROWSER_QA_FAILED:${JSON.stringify(receipt.assertions)}`);
  }
  process.stdout.write(
    `${JSON.stringify({ status, screenshots: screenshotCases.length, receiptSha256: sha256(contents) })}\n`,
  );
}

await main();
