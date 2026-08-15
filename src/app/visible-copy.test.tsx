import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import AreasPage from "@/app/areas/page";
import BlogHubPage from "@/app/blog/page";
import { BlogPostArticle } from "@/components/BlogPostArticle";
import { BLOG_POSTS } from "@/data/blog";
import EveningNotePage from "@/app/evening-note/page";
import GuidePage from "@/app/guide/page";
import LoveSelectPage from "@/app/love-select/page";
import NoticePage from "@/app/notice/page";
import HomePage from "@/app/page";
import PricingPage from "@/app/pricing/page";
import { RegionPage } from "@/components/RegionPage";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { createRegionContent } from "@/lib/region-content";
import { ACTIVE_REGION_NODES } from "@/lib/regions";
import { buildSourceRouteVisibleContracts } from "@/lib/rendered-route-contract";

const FIXED_PAGES = [
  ["/", HomePage],
  ["/areas/", AreasPage],
  ["/pricing/", PricingPage],
  ["/guide/", GuidePage],
  ["/love-select/", LoveSelectPage],
  ["/evening-note/", EveningNotePage],
  ["/notice/", NoticePage],
  ["/blog/", BlogHubPage],
  ...BLOG_POSTS.map((post) => [post.route, () => <BlogPostArticle post={post} />] as const),
] as const;

const FORBIDDEN_VISIBLE_PHRASES = [
  "현재 주소",
  "현재 위치",
  "현재 머무는",
  "머무는 주소",
  "오늘 머무는",
  "서비스를 받을 장소에 머무를 수 있는 시간을",
  "위치",
  "준비 중",
] as const;

function headingLevels(markup: string): number[] {
  return [...markup.matchAll(/<h([1-6])(?:\s|>)/gu)].map((match) => Number(match[1]));
}

function expectNoSkippedHeadingLevels(markup: string, route: string): void {
  const levels = headingLevels(markup);
  expect(levels[0], `${route} must begin with H1`).toBe(1);
  for (let index = 1; index < levels.length; index += 1) {
    expect(
      levels[index] <= levels[index - 1] + 1,
      `${route} skips H${levels[index - 1]} to H${levels[index]}`,
    ).toBe(true);
  }
}

describe("actual visible copy", () => {
  it("binds all 1,301 source-rendered routes to exact visible text and a11y entries", () => {
    const contracts = buildSourceRouteVisibleContracts();
    expect(contracts).toHaveLength(1301);
    expect(new Set(contracts.map((entry) => entry.route)).size).toBe(1301);
    const regional = contracts.filter((entry) => entry.pageType.startsWith("region-"));
    const leaves = regional.filter((entry) => entry.pageType === "region-representative");
    const branches = regional.filter((entry) => entry.pageType !== "region-representative");
    const count = (
      route: (typeof contracts)[number],
      kind: "direct-text" | "block-text" | "aria-label" | "alt-text",
      value: string,
    ) =>
      route.contract.entries.find((entry) => entry.kind === kind && entry.value === value)
        ?.occurrences ?? 0;
    expect(leaves).toHaveLength(1153);
    expect(branches).toHaveLength(138);
    for (const route of regional) {
      for (const label of [
        "TONIGHT DESK",
        "COURSE LEDGER",
        "PAYMENT PRINCIPLE",
        "NO",
        "ADVANCE DEPOSIT",
        "EVENING READING",
      ]) {
        expect(count(route, "direct-text", label), `${route.route}:${label}`).toBe(1);
      }
      expect(count(route, "aria-label", "현장 후불 원칙"), route.route).toBe(1);
    }
    for (const route of leaves) {
      expect(count(route, "direct-text", "ADDRESS CHECK"), route.route).toBe(1);
      expect(count(route, "direct-text", "LOCAL COORDINATES"), route.route).toBe(0);
    }
    for (const route of branches) {
      expect(count(route, "direct-text", "ADDRESS CHECK"), route.route).toBe(0);
      expect(count(route, "direct-text", "LOCAL COORDINATES"), route.route).toBe(1);
    }
    const allValues = contracts.flatMap((route) =>
      route.contract.entries.map((entry) => entry.value),
    ).join("\n");
    for (const phrase of FORBIDDEN_VISIBLE_PHRASES) {
      expect(allValues).not.toContain(phrase);
    }
    expect(allValues).not.toMatch(
      /(?:(?:관리사|제공자|테라피스트|기사).*(?:이동|출발|도착)|(?:이동 거리|이동 시간|교통 상황))/u,
    );
  }, 30_000);

  it("renders every declared regional heading on every route", () => {
    for (const node of ACTIVE_REGION_NODES) {
      const markup = renderToStaticMarkup(<RegionPage node={node} />);
      const content = createRegionContent(node);
      const headingCount = (markup.match(/<h[1-6](?:\s|>)/gu) ?? []).length;
      expect(headingCount, node.path).toBeGreaterThanOrEqual(16);
      for (const heading of content.fields.headings) {
        expect(markup, `${node.path} does not render declared heading: ${heading}`).toContain(
          heading,
        );
      }
      for (const phrase of FORBIDDEN_VISIBLE_PHRASES) {
        expect(markup, `${node.path} contains ${phrase}`).not.toContain(phrase);
      }
    }
  }, 30_000);

  it("renders fixed and common components without current-location assumptions or placeholders", () => {
    const commonMarkup = [
      renderToStaticMarkup(<SiteHeader />),
      renderToStaticMarkup(<SiteFooter />),
    ].join("\n");
    const fixedMarkup = FIXED_PAGES.map(([route, Page]) => ({
      route,
      markup: renderToStaticMarkup(<Page />),
    }));
    const allMarkup = [commonMarkup, ...fixedMarkup.map((entry) => entry.markup)].join("\n");
    for (const phrase of FORBIDDEN_VISIBLE_PHRASES) {
      expect(allMarkup, `fixed/common visible copy contains ${phrase}`).not.toContain(phrase);
    }
    expect(allMarkup).toContain("서비스를 받을 정확한 주소");
    expect(allMarkup).toContain("오늘 저녁에 맞는 코스를 고르는 순서");
    expect(allMarkup).toContain("전화 전에 네 줄만 메모해 두세요");
    expect(allMarkup).not.toContain("SERVICE AREA DIRECTORY");
    expect(allMarkup).not.toContain(">현장 결제 방법<");
  });

  it("keeps fixed-page heading levels sequential", () => {
    for (const [route, Page] of FIXED_PAGES) {
      expectNoSkippedHeadingLevels(renderToStaticMarkup(<Page />), route);
    }
  });
});
