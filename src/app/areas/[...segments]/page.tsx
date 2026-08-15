import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RegionPage } from "@/components/RegionPage";
import { createRegionContent } from "@/lib/region-content";
import { getActiveStaticParams, resolveRegionNode } from "@/lib/regions";
import { absoluteUrl, INDEXABLE_ROBOTS } from "@/lib/site-config";

type Props = {
  params: Promise<{ segments: string[] }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return getActiveStaticParams();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { segments } = await params;
  const node = resolveRegionNode(segments);
  if (!node) return {};
  const content = createRegionContent(node);

  return {
    title: { absolute: content.fields.title },
    description: content.fields.description,
    keywords: content.fields.keywords,
    alternates: { canonical: absoluteUrl(`${node.path}/`) },
    robots: INDEXABLE_ROBOTS,
    openGraph: {
      type: "website",
      title: content.fields.title,
      description: content.fields.description,
      url: absoluteUrl(`${node.path}/`),
      siteName: "마사지러브",
      locale: "ko_KR",
    },
    twitter: {
      card: "summary",
      title: content.fields.title,
      description: content.fields.description,
    },
  };
}

export default async function DynamicRegionPage({ params }: Props) {
  const { segments } = await params;
  const node = resolveRegionNode(segments);
  if (!node) notFound();
  return <RegionPage node={node} />;
}
