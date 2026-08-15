import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site-config";

export const dynamic = "force-static";
export const revalidate = false;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
