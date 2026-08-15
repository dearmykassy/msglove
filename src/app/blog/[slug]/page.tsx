import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogPostArticle, blogPostingJsonLd } from "@/components/BlogPostArticle";
import { BLOG_POSTS, getBlogPost } from "@/data/blog";
import { fixedPageMetadata } from "@/lib/site-config";

type Props = {
  params: Promise<{ slug: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return BLOG_POSTS.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) return {};
  return fixedPageMetadata({
    route: post.route,
    title: post.metadataTitle,
    description: post.metadataDescription,
    openGraphType: "article",
  });
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();
  const jsonLd = JSON.stringify(blogPostingJsonLd(post)).replace(/</gu, "\\u003c");

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd }}
      />
      <BlogPostArticle post={post} />
    </>
  );
}
