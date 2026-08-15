import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import { access, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type ConsoleMessage } from "playwright-core";
import { BUSINESS, COURSE_PRICING, PRICE_ITEM_COUNT } from "../src/data/business";
import { validateLocalChromiumReceipt } from "./local-browser-qa-contract";

type JsonRecord = Record<string, unknown>;

type MeasuredPage = {
  innerWidth: number;
  innerHeight: number;
  scrollWidth: number;
  bodyTextLength: number;
  h1: string | null;
  h1Count: number;
  headingSkip: boolean;
  headerPosition: string | null;
  headerTopBefore: number | null;
  headerTopAfter: number | null;
  desktopNavDisplay: string | null;
  mobileMenuDisplay: string | null;
  mobileSummaryHeight: number | null;
  directoryColumns: number | null;
  addressCheck: boolean;
  localCoordinates: boolean;
  telephoneLinkCount: number;
  telephoneContract: boolean;
  priceRowCount: number;
  priceItemCount: number;
  priceItemsExact: boolean;
  businessFactsExact: boolean;
  directoryModeExact: boolean;
  brokenImages: number;
  customerRoleViolations: string[];
};

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outRoot = path.join(projectRoot, "out");
const defaultChromium =
  "/Users/ssm/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const chromiumPath = process.env.MASSAGE_LOVE_CHROMIUM_PATH ?? defaultChromium;

const routes = [
  { route: "/areas/seoul", pageType: "region-root", directory: "local-coordinates" },
  {
    route: "/areas/seoul/%EA%B0%95%EB%82%A8%EA%B5%AC",
    pageType: "region-hub",
    directory: "local-coordinates",
  },
  {
    route: "/areas/seoul/%EA%B0%95%EB%82%A8%EA%B5%AC/%EC%97%AD%EC%82%BC%EB%8F%99",
    pageType: "region-representative",
    directory: "address-check",
  },
] as const;

const viewports = [
  { width: 320, height: 844 },
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
] as const;

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

async function load(relativePath: string) {
  const bytes = await readFile(path.join(projectRoot, relativePath));
  return {
    path: relativePath,
    bytes,
    sha256: sha256(bytes),
    value: JSON.parse(bytes.toString("utf8")) as JsonRecord,
  };
}

function contentType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  return extension === ".html"
    ? "text/html; charset=utf-8"
    : extension === ".css"
      ? "text/css; charset=utf-8"
      : extension === ".js"
        ? "text/javascript; charset=utf-8"
        : extension === ".json" || extension === ".txt" || extension === ".xml"
          ? "text/plain; charset=utf-8"
          : extension === ".svg"
            ? "image/svg+xml"
            : "application/octet-stream";
}

async function existingFile(candidates: string[]): Promise<string | null> {
  for (const candidate of candidates) {
    try {
      if ((await stat(candidate)).isFile()) return candidate;
    } catch {
      // Continue to the next deterministic static-export candidate.
    }
  }
  return null;
}

async function startStaticServer(): Promise<{ server: Server; origin: string }> {
  const server = createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
      const decodedPath = decodeURIComponent(requestUrl.pathname).replace(/^\/+/, "");
      const normalized = path.normalize(decodedPath || "index.html");
      const resolved = path.resolve(outRoot, normalized);
      if (resolved !== outRoot && !resolved.startsWith(`${outRoot}${path.sep}`)) {
        response.writeHead(403).end();
        return;
      }
      const candidates = requestUrl.pathname.endsWith("/") || !path.extname(resolved)
        ? [path.join(resolved, "index.html"), resolved, `${resolved}.html`]
        : [resolved];
      const filePath = await existingFile(candidates);
      if (!filePath) {
        response.writeHead(404).end();
        return;
      }
      const bytes = await readFile(filePath);
      response.writeHead(200, {
        "content-type": contentType(filePath),
        "content-length": bytes.length,
        "cache-control": "no-store",
      });
      response.end(request.method === "HEAD" ? undefined : bytes);
    } catch {
      response.writeHead(500).end();
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("MASSAGE_LOVE_LOCAL_CHROMIUM_SERVER_ADDRESS_INVALID");
  }
  return { server, origin: `http://127.0.0.1:${address.port}` };
}

async function stopServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function consoleEntry(message: ConsoleMessage): string {
  return `${message.type()}:${message.text()}`;
}

async function main() {
  await access(chromiumPath);
  const [corpus, quality, semantic] = await Promise.all([
    load("artifacts/content-corpus.json"),
    load("artifacts/content-quality-receipt.json"),
    load("artifacts/built-visible-contract-receipt.v1.json"),
  ]);
  const semanticCounts = semantic.value.counts as JsonRecord | undefined;
  if (
    corpus.value.status !== "COMPLETE" ||
    quality.value.status !== "PASS" ||
    !Array.isArray(quality.value.violations) ||
    quality.value.violations.length !== 0 ||
    semantic.value.status !== "PASS" ||
    semantic.value.schemaVersion !==
      "massage-love-built-visible-semantic-contract-receipt/v4" ||
    (semantic.value.corpus as JsonRecord | undefined)?.sha256 !== corpus.sha256 ||
    semanticCounts?.routes !== 1301 ||
    semanticCounts?.failedRoutes !== 0
  ) {
    throw new Error("MASSAGE_LOVE_LOCAL_CHROMIUM_INPUT_NOT_PASS");
  }

  const expectedPrices = COURSE_PRICING.flatMap((course) =>
    course.items.map(
      (item) => `${item.minutes}분${item.price.toLocaleString("ko-KR")}원`,
    ),
  );
  let browser: Browser | null = null;
  let server: Server | null = null;
  const cases: JsonRecord[] = [];
  let browserVersion = "";
  try {
    const started = await startStaticServer();
    server = started.server;
    browser = await chromium.launch({
      executablePath: chromiumPath,
      headless: true,
      args: [
        "--disable-background-networking",
        "--disable-component-update",
        "--disable-default-apps",
        "--disable-sync",
        "--no-first-run",
      ],
    });
    browserVersion = browser.version();

    for (const routeCase of routes) {
      for (const viewport of viewports) {
        const context = await browser.newContext({
          viewport,
          deviceScaleFactor: 1,
          serviceWorkers: "block",
        });
        const page = await context.newPage();
        const consoleErrors: string[] = [];
        const consoleWarnings: string[] = [];
        const pageErrors: string[] = [];
        const requestFailures: string[] = [];
        page.on("console", (message) => {
          if (message.type() === "error") consoleErrors.push(consoleEntry(message));
          if (message.type() === "warning") consoleWarnings.push(consoleEntry(message));
        });
        page.on("pageerror", (error) => pageErrors.push(error.message));
        page.on("requestfailed", (request) => {
          const error = request.failure()?.errorText ?? "UNKNOWN";
          if (!error.includes("net::ERR_ABORTED")) {
            requestFailures.push(`${request.method()}:${request.url()}:${error}`);
          }
        });
        const response = await page.goto(`${started.origin}${routeCase.route}`, {
          waitUntil: "load",
          timeout: 30_000,
        });
        await page.waitForTimeout(80);
        const measured = (await page.evaluate(
          `(async ({ directoryMode, pageType, expectedPhoneHref, expectedPhoneLabel, expectedPrices }) => {
            const normalized = (value) =>
              (value ?? "").replace(/\s+/gu, "").trim();
            const headings = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")];
            const headingLevels = headings.map((heading) => Number(heading.tagName.slice(1)));
            const headingSkip = headingLevels.some(
              (level, index) => index > 0 && level > headingLevels[index - 1] + 1,
            );
            const header = document.querySelector(".site-header");
            const headerPosition = header ? getComputedStyle(header).position : null;
            const headerTopBefore = header?.getBoundingClientRect().top ?? null;
            window.scrollTo(0, Math.min(1200, document.documentElement.scrollHeight));
            await new Promise((resolve) => requestAnimationFrame(() => resolve()));
            const headerTopAfter = header?.getBoundingClientRect().top ?? null;
            window.scrollTo(0, 0);
            const desktopNav = document.querySelector(".desktop-nav");
            const mobileMenu = document.querySelector(".mobile-menu");
            const mobileSummary = document.querySelector(".mobile-menu summary");
            const coordinateGrid = document.querySelector(".coordinate-grid");
            const directoryColumns = coordinateGrid
              ? getComputedStyle(coordinateGrid).gridTemplateColumns
                  .split(" ")
                  .filter(Boolean).length
              : null;
            const telephoneLinks = [
              ...document.querySelectorAll('a[href^="tel:"]'),
            ];
            const priceRows = [...document.querySelectorAll(".price-row")];
            const priceItems = [...document.querySelectorAll(".price-items > span")].map(
              (entry) => normalized(entry.textContent),
            );
            const images = [...document.querySelectorAll("img")];
            const bodyText = document.body.innerText;
            const forbiddenRolePatterns = [
              "상담원",
              "직원을 배정",
              "가까운 대안 지역",
              "현재 위치",
              "제공자가 이동",
            ];
            return {
              innerWidth: window.innerWidth,
              innerHeight: window.innerHeight,
              scrollWidth: Math.max(
                document.documentElement.scrollWidth,
                document.body.scrollWidth,
              ),
              bodyTextLength: bodyText.length,
              h1: document.querySelector("h1")?.textContent?.trim() ?? null,
              h1Count: document.querySelectorAll("h1").length,
              headingSkip,
              headerPosition,
              headerTopBefore,
              headerTopAfter,
              desktopNavDisplay: desktopNav ? getComputedStyle(desktopNav).display : null,
              mobileMenuDisplay: mobileMenu ? getComputedStyle(mobileMenu).display : null,
              mobileSummaryHeight: mobileSummary?.getBoundingClientRect().height ?? null,
              directoryColumns,
              addressCheck: Boolean(document.querySelector(".leaf-directory")),
              localCoordinates: Boolean(coordinateGrid),
              telephoneLinkCount: telephoneLinks.length,
              telephoneContract: telephoneLinks.every(
                (link) =>
                  link.getAttribute("href") === expectedPhoneHref &&
                  link.textContent?.trim() === expectedPhoneLabel,
              ),
              priceRowCount: priceRows.length,
              priceItemCount: priceItems.length,
              priceItemsExact:
                priceItems.length === expectedPrices.length &&
                priceItems.every((value, index) => value === expectedPrices[index]),
              businessFactsExact:
                pageType !== "fixed-page" ||
                location.pathname !== "/guide/" ||
                [
                  "24시간 전화상담",
                  "선입금 없는 100% 현장 후불",
                  "현장 카드 결제 가능",
                ].every((fact) => bodyText.includes(fact)),
              directoryModeExact:
                directoryMode === "address-check"
                  ? Boolean(document.querySelector(".leaf-directory")) && !coordinateGrid
                  : directoryMode === "local-coordinates"
                    ? !document.querySelector(".leaf-directory") && Boolean(coordinateGrid)
                    : !document.querySelector(".leaf-directory") && !coordinateGrid,
              brokenImages: images.filter((image) => image.complete && image.naturalWidth === 0)
                .length,
              customerRoleViolations: forbiddenRolePatterns.filter((pattern) =>
                bodyText.includes(pattern),
              ),
            };
          })(${JSON.stringify({
            directoryMode: routeCase.directory,
            pageType: routeCase.pageType,
            expectedPhoneHref: BUSINESS.phoneHref,
            expectedPhoneLabel: BUSINESS.phoneCtaLabel,
            expectedPrices,
          })})`,
        )) as MeasuredPage;
        const isMobile = viewport.width <= 390;
        const shouldHavePrices = true;
        const expectedTelephoneLinks = 4;
        const expectedDirectoryColumns =
          routeCase.directory === "local-coordinates" ? (isMobile ? 2 : 4) : null;
        const assertions = {
          http200: response?.status() === 200,
          viewportExact:
            measured.innerWidth === viewport.width && measured.innerHeight === viewport.height,
          noHorizontalOverflow: measured.scrollWidth <= viewport.width,
          substantiveBody: measured.bodyTextLength > 1000,
          headingHierarchy: measured.h1Count === 1 && !measured.headingSkip,
          stickyHeader:
            measured.headerPosition === "sticky" &&
            measured.headerTopBefore === 0 &&
            measured.headerTopAfter === 0,
          responsiveNavigation: isMobile
            ? measured.desktopNavDisplay === "none" &&
              measured.mobileMenuDisplay === "block" &&
              Number(measured.mobileSummaryHeight) >= 40
            : measured.desktopNavDisplay === "flex" &&
              measured.mobileMenuDisplay === "none",
          directoryMode: measured.directoryModeExact,
          responsiveDirectoryColumns:
            measured.directoryColumns === expectedDirectoryColumns,
          telephoneCta:
            measured.telephoneContract &&
            measured.telephoneLinkCount === expectedTelephoneLinks,
          exactPriceTable: shouldHavePrices
            ? measured.priceRowCount === COURSE_PRICING.length &&
              measured.priceItemCount === PRICE_ITEM_COUNT &&
              measured.priceItemsExact
            : measured.priceRowCount === 0 && measured.priceItemCount === 0,
          verifiedBusinessFacts: measured.businessFactsExact,
          noBrokenImages: measured.brokenImages === 0,
          customerRole: measured.customerRoleViolations.length === 0,
          cleanRuntime:
            consoleErrors.length === 0 &&
            consoleWarnings.length === 0 &&
            pageErrors.length === 0 &&
            requestFailures.length === 0,
        };
        cases.push({
          route: routeCase.route,
          pageType: routeCase.pageType,
          viewport,
          measured,
          runtime: { consoleErrors, consoleWarnings, pageErrors, requestFailures },
          assertions,
          status: Object.values(assertions).every(Boolean) ? "PASS" : "FAIL",
        });
        await context.close();
      }
    }
  } finally {
    if (browser) await browser.close();
    if (server) await stopServer(server);
  }

  const summary = {
    httpFailures: cases.filter((entry) => !(entry.assertions as JsonRecord).http200).length,
    viewportViolations: cases.filter(
      (entry) => !(entry.assertions as JsonRecord).viewportExact,
    ).length,
    overflowViolations: cases.filter(
      (entry) => !(entry.assertions as JsonRecord).noHorizontalOverflow,
    ).length,
    headingViolations: cases.filter(
      (entry) => !(entry.assertions as JsonRecord).headingHierarchy,
    ).length,
    navigationViolations: cases.filter(
      (entry) => !(entry.assertions as JsonRecord).responsiveNavigation,
    ).length,
    directoryViolations: cases.filter(
      (entry) =>
        !(entry.assertions as JsonRecord).directoryMode ||
        !(entry.assertions as JsonRecord).responsiveDirectoryColumns,
    ).length,
    phoneViolations: cases.filter(
      (entry) => !(entry.assertions as JsonRecord).telephoneCta,
    ).length,
    priceOrFactViolations: cases.filter(
      (entry) =>
        !(entry.assertions as JsonRecord).exactPriceTable ||
        !(entry.assertions as JsonRecord).verifiedBusinessFacts,
    ).length,
    customerRoleViolations: cases.filter(
      (entry) => !(entry.assertions as JsonRecord).customerRole,
    ).length,
    imageViolations: cases.filter(
      (entry) => !(entry.assertions as JsonRecord).noBrokenImages,
    ).length,
    runtimeViolations: cases.filter(
      (entry) => !(entry.assertions as JsonRecord).cleanRuntime,
    ).length,
  };
  if (cases.some((entry) => entry.status !== "PASS") || Object.values(summary).some(Boolean)) {
    throw new Error(`MASSAGE_LOVE_LOCAL_CHROMIUM_FAILED:${JSON.stringify(summary)}`);
  }

  const receipt = {
    schemaVersion: "massage-love-local-chromium-functional-qa/v1",
    status: "PASS_LOCAL_FUNCTIONAL_QA",
    evidenceLane: "LOCAL_CHROMIUM_PLAYWRIGHT_FUNCTIONAL_QA",
    releaseImpact: "FAST_CANDIDATE_EVIDENCE_ONLY",
    authority: {
      scope: "project-local-fast-candidate-evidence-only",
      publicGo: false,
      globalGo: false,
      deploymentAuthorized: false,
    },
    claims: {
      inAppBrowser: false,
      humanReview: false,
      humanVisualReview: false,
      publicGo: false,
    },
    bindings: {
      corpus: { path: corpus.path, sha256: corpus.sha256 },
      quality: { path: quality.path, sha256: quality.sha256 },
      semantic: {
        path: semantic.path,
        sha256: semantic.sha256,
        semanticCaseSetSha256: String(semanticCounts?.semanticCaseSetSha256),
      },
    },
    tooling: {
      driver: "playwright-core",
      driverVersion: "1.62.1",
      browserEngine: "chromium",
      browserVersion,
      executableSource: "playwright-managed-local-chromium",
    },
    reproducibility: {
      command: "pnpm qa:browser:local",
      input: "current out/ static export plus bound semantic/content receipts",
      network: "owned random-port 127.0.0.1 server only",
      browserContext: "new ephemeral context per case",
      requestFailurePolicy:
        "intentional net::ERR_ABORTED route-prefetch cancellations excluded; every other request failure is fatal",
      screenshotsOrImageFilesCreated: false,
      recordedPortOrProcessId: false,
      ownedBrowserAndServerStoppedBeforeReceiptWrite: true,
    },
    matrix: {
      requiredCases: 9,
      completedCases: cases.length,
      widths: [320, 390, 1440],
      routeKinds: ["region-root", "region-hub", "region-representative"],
      fixedRoutes: [],
    },
    images: {
      state: "PLANNED_NO_ASSETS",
      generationSubmissions: 0,
      metaAiCalls: 0,
      screenshotsCreated: 0,
    },
    summary,
    cases,
  };
  const validationInputs = {
    corpusSha256: corpus.sha256,
    qualitySha256: quality.sha256,
    semanticSha256: semantic.sha256,
    semanticCaseSetSha256: String(semanticCounts?.semanticCaseSetSha256),
  };
  validateLocalChromiumReceipt(receipt, validationInputs);
  const contents = `${JSON.stringify(receipt, null, 2)}\n`;
  await writeFile(
    path.join(projectRoot, "artifacts/local-chromium-qa.v1.json"),
    contents,
    "utf8",
  );
  process.stdout.write(
    `${JSON.stringify({
      status: receipt.status,
      cases: cases.length,
      receiptSha256: sha256(contents),
    })}\n`,
  );
}

await main();
