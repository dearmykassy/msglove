import { createHash } from "node:crypto";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import AreasPage from "@/app/areas/page";
import BlogHubPage from "@/app/blog/page";
import EveningNotePage from "@/app/evening-note/page";
import GuidePage from "@/app/guide/page";
import LoveSelectPage from "@/app/love-select/page";
import NoticePage from "@/app/notice/page";
import HomePage from "@/app/page";
import PricingPage from "@/app/pricing/page";
import { BlogPostArticle } from "@/components/BlogPostArticle";
import { RegionPage } from "@/components/RegionPage";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { ACTIVE_REGION_NODES, type RegionNode } from "@/lib/regions";
import { BLOG_POSTS } from "@/data/blog";
import {
  extractVisibleDomContract,
  type VisibleDomContract,
} from "@/lib/visible-dom-contract";

export type SourceRouteVisibleContract = {
  route: string;
  pageType: "fixed-page" | "region-root" | "region-hub" | "region-representative";
  sourceMarkupSha256: string;
  contract: VisibleDomContract;
};

export type SourceRouteMarkup = {
  route: string;
  pageType: SourceRouteVisibleContract["pageType"];
  markup: string;
};

const FIXED_ROUTE_RENDERERS = [
  ["/", HomePage],
  ["/areas/", AreasPage],
  ["/pricing/", PricingPage],
  ["/guide/", GuidePage],
  ["/love-select/", LoveSelectPage],
  ["/evening-note/", EveningNotePage],
  ["/notice/", NoticePage],
  ["/blog/", BlogHubPage],
] as const;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function pageTypeFor(node: RegionNode): SourceRouteVisibleContract["pageType"] {
  if (node.kind === "root") return "region-root";
  if (node.kind === "hub") return "region-hub";
  return "region-representative";
}

function renderShell(page: ReactElement): string {
  return renderToStaticMarkup(
    <>
      <SiteHeader />
      {page}
      <SiteFooter />
    </>,
  );
}

function sourceContract({
  route,
  pageType,
  markup,
}: SourceRouteMarkup): SourceRouteVisibleContract {
  return {
    route,
    pageType,
    sourceMarkupSha256: sha256(markup),
    contract: extractVisibleDomContract(markup, route),
  };
}

export function buildSourceRouteMarkups(): SourceRouteMarkup[] {
  return [
    ...FIXED_ROUTE_RENDERERS.map(([route, Page]) =>
      ({ route, pageType: "fixed-page", markup: renderShell(<Page />) }) as const,
    ),
    ...BLOG_POSTS.map(
      (post) =>
        ({
          route: post.route,
          pageType: "fixed-page" as const,
          markup: renderShell(<BlogPostArticle post={post} />),
        }) as const,
    ),
    ...ACTIVE_REGION_NODES.map((node) =>
      ({
        route: node.path,
        pageType: pageTypeFor(node),
        markup: renderShell(<RegionPage node={node} />),
      }) as const,
    ),
  ];
}

export function buildSourceRouteVisibleContracts(): SourceRouteVisibleContract[] {
  return buildSourceRouteMarkups().map(sourceContract);
}
