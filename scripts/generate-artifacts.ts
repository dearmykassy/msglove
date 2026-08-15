import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { REGION_CONTENT } from "../src/lib/region-content";
import { buildContentQualityReceipt } from "../src/lib/content-quality";
import { ACTIVE_REGION_NODES } from "../src/lib/regions";
import { buildSourceRouteVisibleContracts } from "../src/lib/rendered-route-contract";
import {
  FIXED_VISIBLE_CONTENT,
  getRegionSupplementalVisibleFields,
} from "../src/lib/visible-content";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifactRoot = path.join(projectRoot, "artifacts");
const imageReleasePath = path.join(projectRoot, "pipeline/images/release/image-release.json");

const sourceFiles = {
  capital: path.join(projectRoot, "src/data/capital-regions.generated.json"),
  serviceCities: path.join(projectRoot, "src/data/service-city-regions.generated.json"),
  redirects: path.join(projectRoot, "src/data/service-city-region-redirects.generated.json"),
} as const;

const visibleSourceFiles = [
  "scripts/generate-artifacts.ts",
  "scripts/ai-review-contract.ts",
  "scripts/generate-ai-review.ts",
  "scripts/local-browser-qa-contract.ts",
  "scripts/generate-local-browser-qa.ts",
  "scripts/generate-fast-candidate.ts",
  "scripts/verify-built-visible-contract.ts",
  "scripts/verify-build-semantic-reproducibility.mjs",
  "src/data/business.ts",
  "src/data/region-content.generated.json",
  "src/lib/region-content.ts",
  "src/lib/regions.ts",
  "src/lib/content-quality.ts",
  "src/lib/site-config.ts",
  "src/lib/visible-content.ts",
  "src/lib/visible-dom-contract.ts",
  "src/lib/rendered-route-contract.tsx",
  "src/lib/image-release.ts",
  "src/components/PriceLedger.tsx",
  "src/components/RegionPage.tsx",
  "src/components/RegionDirectory.tsx",
  "src/components/ReleasedHero.tsx",
  "src/components/RootRegionGrid.tsx",
  "src/components/SiteHeader.tsx",
  "src/components/SiteFooter.tsx",
  "scripts/sync-massagebom-region-baseline.ts",
  "src/app/layout.tsx",
  "src/app/page.tsx",
  "src/app/areas/page.tsx",
  "src/app/areas/[...segments]/page.tsx",
  "src/app/pricing/page.tsx",
  "src/app/guide/page.tsx",
  "src/app/love-select/page.tsx",
  "src/app/evening-note/page.tsx",
  "src/app/notice/page.tsx",
  "src/app/blog/page.tsx",
  "src/app/blog/[slug]/page.tsx",
  "src/app/robots.ts",
  "src/app/sitemap.ts",
  "src/components/BlogPostArticle.tsx",
  "src/data/blog.ts",
  "public/images/massage-love-home/v1/home-hero-openai-v1.png",
] as const;

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function stableJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function stableCompact(value: unknown): string {
  const normalize = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(normalize);
    if (input && typeof input === "object") {
      return Object.fromEntries(
        Object.entries(input as Record<string, unknown>)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, child]) => [key, normalize(child)]),
      );
    }
    return input;
  };
  return JSON.stringify(normalize(value));
}

function assertUnique(values: readonly string[], label: string): void {
  if (new Set(values).size !== values.length) {
    throw new Error(`MASSAGE_LOVE_DUPLICATE_${label}`);
  }
}

const SCENES = [
  "quiet reception alcove with a curved architectural counter on the right",
  "private evening reading lounge with sculptural shelving on the right",
  "gallery-like wellness vestibule with an arched portal on the right",
  "rosewood tea salon with a low stone console on the right",
  "double-height arrival hall with a floating stair detail on the right",
  "frosted-glass corridor opening into a softly lit lounge on the right",
  "minimal city-view waiting salon with a framed night window on the right",
  "pearl-stone entry gallery with a single sculptural lamp on the right",
  "intimate library passage with ribbed timber panels on the right",
  "rainy evening conservatory threshold with architectural planting on the right",
  "curved hospitality desk beneath a quiet ceiling canopy on the right",
  "textural wall gallery with a recessed service niche on the right",
  "warm residential foyer with a cantilevered console on the right",
  "moonlit interior courtyard viewed through fluted glass on the right",
  "boutique lounge passage with layered translucent screens on the right",
  "stone-and-timber reception bay with a circular light feature on the right",
  "calm urban salon with an abstract pearl sculpture on the right",
] as const;

const MATERIALS = [
  "dark rosewood veneer, muted burgundy wool, and pearl limestone",
  "smoked oak, claret velvet accents, and honed ivory travertine",
  "ribbed walnut, dusty wine textile, and soft pearl plaster",
  "oxblood lacquer accents, warm walnut, and pale terrazzo",
  "deep merlot fabric, brushed bronze, and cream limestone",
  "rosewood slats, muted mauve upholstery, and satin nickel",
  "charred timber, wine-red woven panels, and pearlescent glass",
  "warm mahogany, clay-burgundy plaster, and shell-toned stone",
  "dark cherry-free timber, muted garnet textile, and pearl concrete",
  "cocoa oak, antique copper, and blush-neutral mineral plaster",
  "walnut burl, aubergine wool, and luminous ivory resin",
  "smoked rosewood, muted raspberry-brown fabric, and cream stone",
  "brown-red microcement, brushed brass, and translucent pearl acrylic",
  "ebonized oak, soft claret leather-like textile, and alabaster stone",
  "warm teak, subdued burgundy felt, and oyster-toned plaster",
  "mahogany lattice, merlot acoustic panels, and pale shell aggregate",
  "rose-brown timber, dark plum textile, and satin pearl metal",
  "walnut fluting, brick-wine fabric, and warm ivory ceramic",
  "dark rosewood, copper-brown mesh, and luminous pearl stone",
] as const;

const LIGHTING = [
  "soft indirect cove light with distant rainy city bokeh",
  "low amber wall washers with a cool night window reflection",
  "concealed ceiling light and a restrained pearl floor glow",
  "late-evening moonlight balanced with warm architectural lamps",
  "subtle bronze sconces and a quiet rain reflection on stone",
  "a narrow vertical light column with dim urban lights beyond",
  "soft perimeter light and a single sculptural pendant glow",
  "warm recessed lighting with restrained violet-grey dusk outside",
  "layered wall grazing light and soft midnight-blue window tones",
  "gentle under-counter light with blurred city lights in the distance",
  "pearl-diffused ceiling light and faint wet-pavement reflections",
  "dim gallery spotlights with a calm burgundy ambient wash",
  "soft lantern-like illumination without visible candles or flames",
  "quiet skylight blue balanced by low warm floor lighting",
  "concealed linear lighting and faint misted-glass reflections",
  "warm niche lighting with controlled shadow across timber panels",
  "soft oval ceiling glow and subtle night skyline bokeh",
  "restrained side lighting with a luminous pearl wall plane",
  "low evening light with copper highlights and deep soft shadows",
] as const;

function regionalPrompt(index: number): string {
  const scene = SCENES[index % SCENES.length];
  const material = MATERIALS[Math.floor(index / SCENES.length) % MATERIALS.length];
  const lighting = LIGHTING[(index * 7) % LIGHTING.length];
  return [
    "Wide 16:9 premium editorial architectural interior photograph for a Korean local service website hero.",
    `Scene: ${scene}.`,
    `Materials: ${material}.`,
    `Lighting: ${lighting}.`,
    "Composition is mandatory: keep the entire leftmost 45 percent visually quiet, low-detail, darker, and unobstructed for white headline copy; place all focal architecture and brighter detail in the right half; preserve generous top safe area for a translucent header.",
    "Sophisticated adult evening-lounge mood, restrained and elegant, realistic photography, natural perspective, refined surfaces, no kitsch, no romance symbols.",
    "Strict exclusions: no people, no human figures, no faces, no hands, no bodies, no body parts, no silhouettes, no beds, no massage beds, no treatment tables, no bedrooms, no towels arranged like bodies, no text, no letters, no numbers, no logo, no sign, no watermark, no brand marks, no hearts, no cherry blossoms, no flowers, no stars, no constellation graphics, no nightclub, no explicit or suggestive imagery.",
  ].join(" ");
}

function homePrompt(): string {
  return [
    "Unique homepage-only wide 16:9 premium architectural photograph of a sophisticated evening arrival lounge, with a sweeping rosewood reception sculpture, pearl-stone wall planes, muted burgundy textile panels, and a luminous circular architectural feature confined to the right half.",
    "Keep the entire leftmost 45 percent dark, calm, low-detail, and unobstructed for a large white headline; preserve generous top safe area for a translucent navigation bar; soft city-night reflections and controlled warm indirect light; mature editorial hospitality mood, realistic materials and perspective.",
    "Strict exclusions: no people, no human figures, no faces, no hands, no bodies, no body parts, no silhouettes, no beds, no massage beds, no treatment tables, no bedrooms, no text, no letters, no numbers, no logo, no sign, no watermark, no brand marks, no hearts, no cherry blossoms, no flowers, no stars, no constellation graphics, no nightclub, no explicit or suggestive imagery.",
  ].join(" ");
}

function plannedAssetBinding() {
  return {
    source: { path: null, sha256: null },
    refinement: {
      receiptSha256: null,
      desktop: { path: null, sha256: null, width: 2048, height: 922 },
      tablet: { path: null, sha256: null, width: 1536, height: 1024 },
      mobile: { path: null, sha256: null, width: 1024, height: 2048 },
    },
    publicAsset: { manifestSha256: null, paths: null, sha256: null },
    perceptualHash: null,
    palette: {
      status: "PENDING_REFINED_ASSET_ANALYSIS",
      topDominantHex: null,
      gradientStops: null,
    },
    headerBinding: {
      status: "PENDING_PALETTE",
      alphaTarget: { min: 0.88, max: 0.94 },
      gradient: null,
    },
  };
}

async function main() {
  await mkdir(artifactRoot, { recursive: true });

  const sourceBuffers = {
    capital: await readFile(sourceFiles.capital),
    serviceCities: await readFile(sourceFiles.serviceCities),
    redirects: await readFile(sourceFiles.redirects),
  };
  const sourceHashes = {
    capital: sha256(sourceBuffers.capital),
    serviceCities: sha256(sourceBuffers.serviceCities),
    redirects: sha256(sourceBuffers.redirects),
  };
  const visibleSourceBuffers = await Promise.all(
    visibleSourceFiles.map(async (relativePath) => ({
      path: relativePath,
      bytes: await readFile(path.join(projectRoot, relativePath)),
    })),
  );
  let imageRelease: null | { status?: string; images?: unknown } = null;
  let imageReleaseBytes: Buffer | null = null;
  try {
    imageReleaseBytes = await readFile(imageReleasePath);
    const parsedImageRelease = JSON.parse(imageReleaseBytes.toString("utf8")) as {
      status?: string;
      images?: unknown;
    };
    if (parsedImageRelease.status !== "COMPLETE" || !parsedImageRelease.images) {
      throw new Error("MASSAGE_LOVE_IMAGE_RELEASE_INCOMPLETE");
    }
    imageRelease = parsedImageRelease;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const sourceManifest = [
    {
      path: "src/data/capital-regions.generated.json",
      sha256: sourceHashes.capital,
    },
    {
      path: "src/data/service-city-region-redirects.generated.json",
      sha256: sourceHashes.redirects,
    },
    {
      path: "src/data/service-city-regions.generated.json",
      sha256: sourceHashes.serviceCities,
    },
    ...visibleSourceBuffers.map((source) => ({
      path: source.path,
      sha256: sha256(source.bytes),
    })),
    ...(imageReleaseBytes
      ? [
          {
            path: "pipeline/images/release/image-release.json",
            sha256: sha256(imageReleaseBytes),
          },
        ]
      : []),
  ].sort((left, right) => left.path.localeCompare(right.path));
  const sourceManifestSha256 = sha256(stableCompact(sourceManifest));

  if (
    sourceHashes.capital !== "0242e5d86894321cba66b7f747675115520d856c7aaada870869e19f247500d2" ||
    sourceHashes.serviceCities !== "72a318974585509632ba229307a954d01c40adcb8d98ff4ba6fbd1f1655f0d3d" ||
    sourceHashes.redirects !== "53249fbc2541f96c4ef725797436a56b64cb4bdb6a94ea58c3d32974f0ed8125"
  ) {
    throw new Error("MASSAGE_LOVE_REGION_SOURCE_SHA_MISMATCH");
  }

  assertUnique(REGION_CONTENT.map((entry) => entry.route), "ROUTE");
  assertUnique(REGION_CONTENT.map((entry) => entry.fields.title), "TITLE");
  assertUnique(REGION_CONTENT.map((entry) => entry.fields.description), "DESCRIPTION");
  assertUnique(REGION_CONTENT.map((entry) => entry.fields.h1), "H1");
  assertUnique(REGION_CONTENT.map((entry) => entry.commercialName), "COMMERCIAL_NAME");

  const routeVisibleContracts = buildSourceRouteVisibleContracts();
  if (routeVisibleContracts.length !== 1301) {
    throw new Error(
      `MASSAGE_LOVE_ROUTE_VISIBLE_CONTRACT_COUNT:${routeVisibleContracts.length}`,
    );
  }
  assertUnique(routeVisibleContracts.map((entry) => entry.route), "VISIBLE_CONTRACT_ROUTE");
  const routeVisibleByPath = new Map(
    routeVisibleContracts.map((entry) => [entry.route, entry]),
  );

  const renderedRegionEntries = REGION_CONTENT.map((entry, index) => {
    const node = ACTIVE_REGION_NODES[index];
    if (entry.route !== node.path) {
      throw new Error(`MASSAGE_LOVE_RENDERED_ROUTE_ORDER_MISMATCH:${entry.route}`);
    }
    return {
      ...entry,
      rendered: {
        declaredHeadings: entry.fields.headings,
        declaredParagraphs: entry.fields.paragraphs,
        supplemental: getRegionSupplementalVisibleFields(node),
        visibleContract: routeVisibleByPath.get(entry.route),
      },
    };
  });
  const renderedRegionalHeadingCount = renderedRegionEntries.reduce(
    (count, entry) => count + entry.rendered.declaredHeadings.length,
    0,
  );
  const renderedSupplementalStringCount = renderedRegionEntries.reduce(
    (count, entry) =>
      count +
      entry.rendered.supplemental.headings.length +
      entry.rendered.supplemental.paragraphs.length +
      entry.rendered.supplemental.labels.length,
    0,
  );

  const contentCorpus = {
    schemaVersion: "cross-platform-content-corpus/v1",
    platformId: "massage-love",
    brand: "마사지러브",
    status: "COMPLETE",
    counts: {
      documents: REGION_CONTENT.length,
      titles: REGION_CONTENT.length,
      descriptions: REGION_CONTENT.length,
      h1: REGION_CONTENT.length,
      paragraphs: REGION_CONTENT.reduce(
        (count, entry) => count + entry.fields.paragraphs.length,
        0,
      ),
      keywords: REGION_CONTENT.reduce(
        (count, entry) => count + entry.fields.keywords.length,
        0,
      ),
      fixedDocuments: FIXED_VISIBLE_CONTENT.length,
      totalVisibleDocuments: REGION_CONTENT.length + FIXED_VISIBLE_CONTENT.length,
      declaredRegionalHeadings: renderedRegionalHeadingCount,
      renderedRegionalHeadings: renderedRegionalHeadingCount,
      renderedSupplementalStrings: renderedSupplementalStringCount,
      routeVisibleContracts: routeVisibleContracts.length,
      routeVisibleOccurrences: routeVisibleContracts.reduce(
        (count, entry) => count + entry.contract.occurrenceCount,
        0,
      ),
    },
    sourceManifest,
    sourceManifestSha256,
    regionSourceSha256: sourceHashes,
    entries: renderedRegionEntries,
    fixedEntries: FIXED_VISIBLE_CONTENT,
    routeVisibleContracts,
    renderingContract: {
      status: "COMPLETE",
      declaredRegionalHeadingCount: renderedRegionalHeadingCount,
      renderedRegionalHeadingCount,
      regionHeadingSlots: {
        "0": "RegionDirectory on root, hub, and representative routes",
        "1": "RegionPage consultation desk",
        "2": "RegionPage course ledger",
        "3": "RegionPage payment principle",
        "4": "RegionPage visit flow",
        "5": "RegionPage FAQ",
        "6": "RegionPage editorial reading section",
      },
      commonAndFixedVisibleCopyIncluded: true,
      authority: "routeVisibleContracts exact body text/a11y multiset",
      corpusDeclaredButNotSourceRenderedOccurrences: 0,
      sourceRenderedButNotCorpusDeclaredOccurrences: 0,
      builtVerificationReceipt: "artifacts/built-visible-contract-receipt.v1.json",
    },
    ...(imageRelease ? { images: imageRelease.images } : {}),
  };

  const regionalImages = Array.from({ length: 323 }, (_, index) => {
    const number = String(index + 1).padStart(3, "0");
    const prompt = regionalPrompt(index);
    return {
      imageId: `MLV-RH-${number}`,
      jobId: `massage-love-region-hero-${number}-a1`,
      outputNamespace: `massage-love/region-heroes/v1/MLV-RH-${number}/a1`,
      status: "PLANNED",
      prompt,
      promptSha256: sha256(prompt),
      referenceImages: [],
      ...plannedAssetBinding(),
    };
  });

  assertUnique(regionalImages.map((image) => image.prompt), "IMAGE_PROMPT");
  assertUnique(regionalImages.map((image) => image.promptSha256), "IMAGE_PROMPT_SHA");

  const assignmentCounts = new Map<string, number>();
  const assignments = ACTIVE_REGION_NODES.map((node, routeIndex) => {
    const image = regionalImages[routeIndex % regionalImages.length];
    assignmentCounts.set(image.imageId, (assignmentCounts.get(image.imageId) ?? 0) + 1);
    return {
      route: node.path,
      regionId: node.id,
      regionName: node.displayName,
      imageId: image.imageId,
      status: "PLANNED_NO_ASSET",
      sourceSha256: null,
      refinementReceiptSha256: null,
      publicAssetSha256: null,
      perceptualHash: null,
      palette: null,
      headerGradient: null,
    };
  });

  const distribution = [...assignmentCounts.values()].reduce(
    (counts, count) => ({ ...counts, [count]: (counts[count] ?? 0) + 1 }),
    {} as Record<number, number>,
  );
  if (distribution[4] !== 322 || distribution[3] !== 1) {
    throw new Error(`MASSAGE_LOVE_IMAGE_DISTRIBUTION_INVALID:${JSON.stringify(distribution)}`);
  }

  const homeHeroText = homePrompt();
  const homeHero = {
    imageId: "MLV-HOME-001",
    jobId: "massage-love-home-hero-001-a1",
    outputNamespace: "massage-love/home-hero/v1/MLV-HOME-001/a1",
    status: "PLANNED",
    exclusiveToRoute: "/",
    allowRegionalReuse: false,
    prompt: homeHeroText,
    promptSha256: sha256(homeHeroText),
    referenceImages: [],
    ...plannedAssetBinding(),
  };

  const imageCampaignContract = {
    schemaVersion: "massage-love-region-hero-campaign/v1",
    platformId: "massage-love",
    status: "PLANNED_NO_ASSETS",
    rules: {
      textOnly: true,
      referencesPerJob: 0,
      leftSafeAreaPercent: 45,
      forbidden: [
        "people",
        "human figures",
        "faces",
        "hands",
        "bodies",
        "body parts",
        "silhouettes",
        "beds",
        "massage beds",
        "treatment tables",
        "bedrooms",
        "text",
        "letters",
        "numbers",
        "logos",
        "signs",
        "watermarks",
        "hearts",
        "cherry blossoms",
        "flowers",
        "stars",
        "constellation graphics",
      ],
      sourceMustPassHumanQa: true,
      refinementRequiredBeforePublicUse: true,
      paletteMustComeFromRefinedTopArea: true,
      atomicPromotionOnly: true,
    },
    counts: {
      routes: assignments.length,
      regionalImages: regionalImages.length,
      homeHeroes: 1,
      regionalReuseDistribution: distribution,
    },
    homeHero,
    regionalImages,
    assignments,
  };

  const jobs = [homeHero, ...regionalImages].map((image, index) => ({
    order: index + 1,
    jobId: image.jobId,
    imageId: image.imageId,
    prompt: image.prompt,
    promptSha256: image.promptSha256,
    referenceImages: [],
    outputNamespace: image.outputNamespace,
  }));
  const waves = Array.from({ length: Math.ceil(jobs.length / 5) }, (_, waveIndex) => ({
    wave: waveIndex + 1,
    lanes: jobs.slice(waveIndex * 5, waveIndex * 5 + 5).map((job, laneIndex) => ({
      lane: laneIndex + 1,
      jobId: job.jobId,
      imageId: job.imageId,
    })),
  }));
  const imageGenerationPlan = {
    schemaVersion: "massage-love-image-generation-plan/v1",
    platformId: "massage-love",
    status: "READY_FOR_COORDINATED_RUN",
    transport: "meta-ai-dedicated-session",
    runtimeLanes: 5,
    preconditions: {
      authenticatedDedicatedSession: true,
      activeOrUncertainJobsMustBeZero: true,
      exactJobBindingRequired: true,
      retriesOnlyForProvenPreSubmitFailure: true,
      sourceQaBeforeRefinement: true,
    },
    counts: {
      jobs: jobs.length,
      regional: regionalImages.length,
      home: 1,
      waves: waves.length,
      fullFiveLaneWaves: waves.filter((wave) => wave.lanes.length === 5).length,
      finalWaveSize: waves.at(-1)?.lanes.length ?? 0,
    },
    jobs,
    waves,
  };

  const regionSourceManifest = {
    schemaVersion: "massage-love-region-source/v1",
    status: "COMMITTED",
    derivedFrom: "MassageBom verified regional graph only",
    effectiveDates: { capital: "2026-07-20", serviceCities: "2026-07-20" },
    counts: {
      activeRoutes: ACTIVE_REGION_NODES.length,
      capitalRepresentativeRegions: 768,
      serviceRepresentativeRegions: 385,
      originalCapitalAdministrativeUnits: 1187,
      originalServiceAdministrativeUnits: 583,
    },
    files: {
      capital: { path: "src/data/capital-regions.generated.json", sha256: sourceHashes.capital },
      serviceCities: { path: "src/data/service-city-regions.generated.json", sha256: sourceHashes.serviceCities },
      redirects: { path: "src/data/service-city-region-redirects.generated.json", sha256: sourceHashes.redirects },
    },
    activeRouteProjectionSha256: sha256(
      ACTIVE_REGION_NODES.map((node) => node.path).join("\n"),
    ),
  };

  const contentQualityReceipt = buildContentQualityReceipt(routeVisibleContracts);
  if (contentQualityReceipt.status !== "PASS") {
    throw new Error(
      `MASSAGE_LOVE_CONTENT_QUALITY_FAILED:${JSON.stringify(contentQualityReceipt.violations)}`,
    );
  }

  const files = {
    "content-corpus.json": stableJson(contentCorpus),
    "content-quality-receipt.json": stableJson(contentQualityReceipt),
    "image-campaign-contract.json": stableJson(imageCampaignContract),
    "image-generation-plan.json": stableJson(imageGenerationPlan),
    "region-source-manifest.json": stableJson(regionSourceManifest),
  };
  for (const [filename, contents] of Object.entries(files)) {
    await writeFile(path.join(artifactRoot, filename), contents, "utf8");
  }

  const receipt = {
    schemaVersion: "massage-love-artifact-receipt/v1",
    status: "VERIFIED",
    files: Object.fromEntries(
      Object.entries(files).map(([filename, contents]) => [
        filename,
        { sha256: sha256(contents), bytes: Buffer.byteLength(contents) },
      ]),
    ),
  };
  await writeFile(
    path.join(artifactRoot, "artifact-receipt.json"),
    stableJson(receipt),
    "utf8",
  );

  process.stdout.write(
    `${JSON.stringify({
      documents: REGION_CONTENT.length,
      regionalImages: regionalImages.length,
      imageJobs: jobs.length,
      waves: waves.length,
      receipt: receipt.files,
    })}\n`,
  );
}

await main();
