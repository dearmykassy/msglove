import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { absoluteUrl } from "../src/lib/site-config";
import { REGION_CONTENT } from "../src/lib/region-content";
import { FIXED_VISIBLE_CONTENT } from "../src/lib/visible-content";
import { buildSourceRouteVisibleContracts } from "../src/lib/rendered-route-contract";
import {
  buildCompactContentCorpus,
  stableCompact,
  type CompactContentCorpus,
} from "./content-corpus-projection";
import {
  compareVisibleDomContracts,
  extractVisibleDomContract,
  normalizeVisibleDomValue,
  type VisibleDomEntry,
} from "../src/lib/visible-dom-contract";

type CorpusDocument = {
  route: string;
  pageType: string;
  fields: {
    title: string;
    description: string;
    keywords?: string[];
  };
};

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifactRoot = path.join(projectRoot, "artifacts");
const outRoot = path.join(projectRoot, "out");
const corpusPath = path.join(artifactRoot, "content-corpus.json");

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function builtHtmlPath(route: string): string {
  if (route === "/") return path.join(outRoot, "index.html");
  const decoded = decodeURIComponent(route).replace(/^\/+|\/+$/gu, "");
  return path.join(outRoot, decoded, "index.html");
}

function occurrenceCount(entries: readonly VisibleDomEntry[]): number {
  return entries.reduce((count, entry) => count + entry.occurrences, 0);
}

function attributes(tag: string): Map<string, string> {
  const opening = tag.match(/^<\s*[a-z0-9:-]+/iu)?.[0] ?? "";
  const raw = tag.slice(opening.length).replace(/\/?>\s*$/u, "");
  const result = new Map<string, string>();
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/gu;
  for (const match of raw.matchAll(pattern)) {
    result.set(
      match[1].toLowerCase(),
      normalizeVisibleDomValue(match[2] ?? match[3] ?? match[4] ?? ""),
    );
  }
  return result;
}

function headMarkup(html: string): string {
  return html.match(/<head(?:\s[^>]*)?>([\s\S]*?)<\/head>/iu)?.[1] ?? "";
}

function singleValue(values: string[]): string | null {
  return values.length === 1 ? values[0] : null;
}

function metadataValue(
  head: string,
  selector: { name?: string; property?: string },
): string | null {
  const values = [...head.matchAll(/<meta\b[^>]*>/giu)].flatMap((match) => {
    const attrs = attributes(match[0]);
    const selectorMatch = selector.name
      ? attrs.get("name") === selector.name
      : attrs.get("property") === selector.property;
    return selectorMatch ? [attrs.get("content") ?? ""] : [];
  });
  return singleValue(values);
}

function linkValue(head: string, rel: string): string | null {
  const values = [...head.matchAll(/<link\b[^>]*>/giu)].flatMap((match) => {
    const attrs = attributes(match[0]);
    return attrs.get("rel") === rel ? [attrs.get("href") ?? ""] : [];
  });
  return singleValue(values);
}

function titleValue(head: string): string | null {
  const values = [...head.matchAll(/<title>([\s\S]*?)<\/title>/giu)].map((match) =>
    normalizeVisibleDomValue(match[1]),
  );
  return singleValue(values);
}

function expectedTitle(document: CorpusDocument): string {
  return document.route === "/"
    ? document.fields.title
    : document.pageType === "fixed-page"
      ? `${document.fields.title} · 마사지러브`
      : document.fields.title;
}

function expectedCanonical(document: CorpusDocument): string {
  return absoluteUrl(document.route === "/" ? "/" : `${document.route.replace(/\/$/u, "")}/`);
}

function difference(left: readonly string[], right: readonly string[]): string[] {
  const rightSet = new Set(right);
  return left.filter((value) => !rightSet.has(value));
}

async function main() {
  // Rebuild the compact projection from source and compare it to the committed
  // content-only artifact. This deliberately never invokes the legacy image
  // artifact generator.
  const routeVisibleContracts = buildSourceRouteVisibleContracts();
  const expectedCorpus = await buildCompactContentCorpus(routeVisibleContracts);
  const corpusBytes = await readFile(corpusPath);
  const corpus = JSON.parse(corpusBytes.toString("utf8")) as CompactContentCorpus;
  if (
    corpus.status !== "COMPLETE" ||
    corpus.entries.length !== 1291 ||
    corpus.fixedEntries.length !== 11 ||
    corpus.sourceProjectionSha256 !== expectedCorpus.sourceProjectionSha256 ||
    stableCompact(corpus) !== stableCompact(expectedCorpus)
  ) {
    throw new Error("MASSAGE_LOVE_CONTENT_CORPUS_SOURCE_DRIFT");
  }
  const corpusEntries: CorpusDocument[] = REGION_CONTENT.map((entry) => ({
    route: entry.route,
    pageType: entry.pageType,
    fields: entry.fields,
  }));
  const fixedEntries: CorpusDocument[] = FIXED_VISIBLE_CONTENT.map((entry) => ({
    route: entry.route,
    pageType: entry.pageType,
    fields: entry.fields,
  }));
  const documents: CorpusDocument[] = [
    ...fixedEntries.filter((entry) => entry.route !== "__site-common__"),
    ...corpusEntries,
  ];
  if (documents.length !== 1301) {
    throw new Error(`MASSAGE_LOVE_SEO_DOCUMENT_COUNT_INVALID:${documents.length}`);
  }
  const documentByRoute = new Map(documents.map((document) => [document.route, document]));
  const visibleCases = [];
  const seoCases = [];

  for (const declared of routeVisibleContracts) {
    const htmlPath = builtHtmlPath(declared.route);
    const htmlBytes = await readFile(htmlPath);
    const html = htmlBytes.toString("utf8");
    const rendered = extractVisibleDomContract(html, declared.route);
    const comparison = compareVisibleDomContracts(declared.contract, rendered);
    const semanticCase = {
      route: declared.route,
      pageType: declared.pageType,
      sourceMarkupSha256: declared.sourceMarkupSha256,
      declaredContractSha256: declared.contract.digestSha256,
      renderedContractSha256: rendered.digestSha256,
      declaredOccurrences: declared.contract.occurrenceCount,
      renderedOccurrences: rendered.occurrenceCount,
      declaredUniqueEntries: declared.contract.uniqueEntryCount,
      renderedUniqueEntries: rendered.uniqueEntryCount,
      declaredButNotRenderedOccurrences: occurrenceCount(
        comparison.declaredButNotRendered,
      ),
      renderedButNotDeclaredOccurrences: occurrenceCount(
        comparison.renderedButNotDeclared,
      ),
      declaredButNotRenderedExamples: comparison.declaredButNotRendered.slice(0, 12),
      renderedButNotDeclaredExamples: comparison.renderedButNotDeclared.slice(0, 12),
      status:
        comparison.declaredButNotRendered.length === 0 &&
        comparison.renderedButNotDeclared.length === 0
          ? "PASS"
          : "FAIL",
    };
    visibleCases.push(semanticCase);

    const document = documentByRoute.get(declared.route);
    if (!document) throw new Error(`MASSAGE_LOVE_SEO_DOCUMENT_MISSING:${declared.route}`);
    const head = headMarkup(html);
    const expected = {
      title: expectedTitle(document),
      description: document.fields.description,
      canonical: expectedCanonical(document),
      robots: "index, follow",
      keywords: document.fields.keywords?.length
        ? document.fields.keywords.join(",")
        : null,
      openGraph: {
        title: expectedTitle(document),
        description: document.fields.description,
        url: expectedCanonical(document),
      },
      twitter: {
        card: "summary",
        title: expectedTitle(document),
        description: document.fields.description,
      },
    };
    const actual = {
      title: titleValue(head),
      description: metadataValue(head, { name: "description" }),
      canonical: linkValue(head, "canonical"),
      robots: metadataValue(head, { name: "robots" }),
      keywords: metadataValue(head, { name: "keywords" }),
      openGraph: {
        title: metadataValue(head, { property: "og:title" }),
        description: metadataValue(head, { property: "og:description" }),
        url: metadataValue(head, { property: "og:url" }),
      },
      twitter: {
        card: metadataValue(head, { name: "twitter:card" }),
        title: metadataValue(head, { name: "twitter:title" }),
        description: metadataValue(head, { name: "twitter:description" }),
      },
    };
    const violations = [
      ...(actual.title === expected.title ? [] : ["TITLE"]),
      ...(actual.description === expected.description ? [] : ["DESCRIPTION"]),
      ...(actual.canonical === expected.canonical ? [] : ["CANONICAL"]),
      ...(actual.robots === expected.robots ? [] : ["ROBOTS"]),
      ...(actual.keywords === expected.keywords ? [] : ["KEYWORDS"]),
      ...(actual.openGraph.title === expected.openGraph.title ? [] : ["OG_TITLE"]),
      ...(actual.openGraph.description === expected.openGraph.description
        ? []
        : ["OG_DESCRIPTION"]),
      ...(actual.openGraph.url === expected.openGraph.url ? [] : ["OG_URL"]),
      ...(actual.twitter.card === expected.twitter.card ? [] : ["TWITTER_CARD"]),
      ...(actual.twitter.title === expected.twitter.title ? [] : ["TWITTER_TITLE"]),
      ...(actual.twitter.description === expected.twitter.description
        ? []
        : ["TWITTER_DESCRIPTION"]),
    ];
    seoCases.push({
      route: declared.route,
      pageType: declared.pageType,
      expected,
      actual,
      violations,
      status: violations.length === 0 ? "PASS" : "FAIL",
    });
  }

  const declaredButNotRenderedOccurrences = visibleCases.reduce(
    (count, entry) => count + entry.declaredButNotRenderedOccurrences,
    0,
  );
  const renderedButNotDeclaredOccurrences = visibleCases.reduce(
    (count, entry) => count + entry.renderedButNotDeclaredOccurrences,
    0,
  );
  const sitemapBytes = await readFile(path.join(outRoot, "sitemap.xml"));
  const sitemapUrls = [...sitemapBytes.toString("utf8").matchAll(/<loc>([\s\S]*?)<\/loc>/giu)]
    .map((match) => normalizeVisibleDomValue(match[1]));
  const expectedSitemapUrls = documents.map(expectedCanonical);
  const sitemap = {
    expectedUrls: expectedSitemapUrls.length,
    actualUrls: sitemapUrls.length,
    uniqueActualUrls: new Set(sitemapUrls).size,
    missing: difference(expectedSitemapUrls, sitemapUrls),
    extra: difference(sitemapUrls, expectedSitemapUrls),
    sha256: sha256(sitemapBytes),
  };
  const seoUniqueness = {
    titles: new Set(seoCases.map((entry) => entry.actual.title)).size,
    descriptions: new Set(seoCases.map((entry) => entry.actual.description)).size,
    canonicals: new Set(seoCases.map((entry) => entry.actual.canonical)).size,
    openGraphTitles: new Set(seoCases.map((entry) => entry.actual.openGraph.title)).size,
    openGraphDescriptions: new Set(
      seoCases.map((entry) => entry.actual.openGraph.description),
    ).size,
    openGraphUrls: new Set(seoCases.map((entry) => entry.actual.openGraph.url)).size,
    twitterTitles: new Set(seoCases.map((entry) => entry.actual.twitter.title)).size,
    twitterDescriptions: new Set(
      seoCases.map((entry) => entry.actual.twitter.description),
    ).size,
    regionalKeywords: new Set(
      seoCases
        .filter((entry) => entry.pageType !== "fixed-page")
        .map((entry) => entry.actual.keywords),
    ).size,
  };
  const seoPass =
    seoCases.length === 1301 &&
    seoCases.every((entry) => entry.status === "PASS") &&
    Object.entries(seoUniqueness).every(([field, count]) =>
      field === "regionalKeywords" ? count === 1291 : count === 1301,
    ) &&
    sitemap.actualUrls === 1301 &&
    sitemap.uniqueActualUrls === 1301 &&
    sitemap.missing.length === 0 &&
    sitemap.extra.length === 0;
  const semanticCaseSetSha256 = sha256(
    JSON.stringify({ visibleCases, seoCases, sitemap, seoUniqueness }),
  );
  const status =
    declaredButNotRenderedOccurrences === 0 &&
    renderedButNotDeclaredOccurrences === 0 &&
    seoPass
      ? "PASS"
      : "FAIL";
  const receipt = {
    schemaVersion: "massage-love-built-visible-semantic-contract-receipt/v4",
    status,
    corpus: {
      path: "artifacts/content-corpus.json",
      sha256: sha256(corpusBytes),
      sourceManifestSha256: corpus.sourceManifestSha256,
      sourceProjectionSha256: corpus.sourceProjectionSha256,
    },
    policy: {
      visibleScope:
        "every exported route body: element-bound direct text, reconstructed semantic blocks, aria-label, and non-empty alt text",
      visibleComparison:
        "route-scoped exact element identity, tag, kind, document order, entry order, value, and occurrence count in both directions",
      seoScope:
        "all 1,301 exported routes: title, description, canonical, index/follow robots, Open Graph, Twitter, 1,291 regional keyword sets, and exact sitemap projection",
      releaseAuthority:
        "path-independent route semantic contracts, source markup bindings, built SEO values, and sitemap projection",
      declaredButNotRenderedAllowed: false,
      renderedButNotDeclaredAllowed: false,
    },
    counts: {
      routes: visibleCases.length,
      passedRoutes: visibleCases.filter((entry) => entry.status === "PASS").length,
      failedRoutes: visibleCases.filter((entry) => entry.status === "FAIL").length,
      declaredOccurrences: visibleCases.reduce(
        (count, entry) => count + entry.declaredOccurrences,
        0,
      ),
      renderedOccurrences: visibleCases.reduce(
        (count, entry) => count + entry.renderedOccurrences,
        0,
      ),
      declaredButNotRenderedOccurrences,
      renderedButNotDeclaredOccurrences,
      semanticCaseSetSha256,
    },
    seo: {
      status: seoPass ? "PASS" : "FAIL",
      counts: {
        routes: seoCases.length,
        fixedRoutes: seoCases.filter((entry) => entry.pageType === "fixed-page").length,
        regionalRoutes: seoCases.filter((entry) => entry.pageType !== "fixed-page").length,
        failedRoutes: seoCases.filter((entry) => entry.status !== "PASS").length,
      },
      uniqueness: seoUniqueness,
      sitemap,
      cases: seoCases,
    },
    cases: visibleCases,
  };
  const receiptPath = path.join(artifactRoot, "built-visible-contract-receipt.v1.json");
  const receiptContents = `${JSON.stringify(receipt, null, 2)}\n`;
  const receiptSha256 = sha256(receiptContents);
  await writeFile(receiptPath, receiptContents, "utf8");
  if (receipt.status !== "PASS") {
    const visibleFailures = visibleCases.filter((entry) => entry.status === "FAIL").slice(0, 5);
    const seoFailures = seoCases.filter((entry) => entry.status === "FAIL").slice(0, 5);
    throw new Error(
      `MASSAGE_LOVE_BUILT_SEMANTIC_CONTRACT_FAILED:${JSON.stringify({ visibleFailures, seoFailures, sitemap, seoUniqueness })}`,
    );
  }
  process.stdout.write(
    `${JSON.stringify({
      status: receipt.status,
      routes: receipt.counts.routes,
      occurrences: receipt.counts.renderedOccurrences,
      declaredButNotRenderedOccurrences,
      renderedButNotDeclaredOccurrences,
      seoRoutes: receipt.seo.counts.routes,
      seoFailures: receipt.seo.counts.failedRoutes,
      semanticCaseSetSha256,
      receiptSha256,
    })}\n`,
  );
}

await main();
