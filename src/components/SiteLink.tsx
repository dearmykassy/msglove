import type { ComponentProps } from "react";
import NextLink from "next/link";

type SiteLinkProps = ComponentProps<typeof NextLink>;

/**
 * Keep Next's automatic route prefetch out of production crawl traffic.
 * Explicit prefetch remains available during local development only.
 */
export default function SiteLink(props: SiteLinkProps) {
  const prefetch = process.env.NODE_ENV === "production" ? false : props.prefetch;

  return <NextLink {...props} prefetch={prefetch} />;
}
