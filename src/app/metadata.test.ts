import { describe, expect, it } from "vitest";
import { metadata as homeMetadata } from "@/app/page";
import { generateMetadata as generateRegionMetadata } from "@/app/areas/[...segments]/page";
import { createRegionContent } from "@/lib/region-content";
import { ACTIVE_REGION_NODES } from "@/lib/regions";
import { absoluteUrl } from "@/lib/site-config";
import { HOME_COPY } from "@/lib/visible-content";

describe("emitted MassageLove metadata", () => {
  it("sets an explicit, platform-appropriate home title and keyword set", () => {
    expect(HOME_COPY.metadataTitle).toBe(
      "마사지러브 | 전국 출장 마사지 · 지역별 코스·가격 안내",
    );
    expect(HOME_COPY.metadataKeywords).toEqual([
      "마사지러브",
      "전국 출장 마사지",
      "지역별 출장 마사지",
      "24시간 상담",
    ]);
    expect(homeMetadata).toMatchObject({
      title: { absolute: HOME_COPY.metadataTitle },
      description: HOME_COPY.metadataDescription,
      keywords: [...HOME_COPY.metadataKeywords],
      openGraph: {
        title: HOME_COPY.metadataTitle,
        description: HOME_COPY.metadataDescription,
      },
      twitter: {
        title: HOME_COPY.metadataTitle,
        description: HOME_COPY.metadataDescription,
      },
    });
  });

  it("emits unique MassageBom-pattern regional metadata for all 1,291 routes", async () => {
    const emitted = await Promise.all(
      ACTIVE_REGION_NODES.map(async (node) => {
        const content = createRegionContent(node);
        const metadata = await generateRegionMetadata({
          params: Promise.resolve({ segments: [...node.segments] }),
        });
        return { node, content, metadata };
      }),
    );

    expect(emitted).toHaveLength(1291);
    expect(
      new Set(
        emitted.map(({ metadata }) => (metadata.title as { absolute: string }).absolute),
      ).size,
    ).toBe(1291);

    for (const { node, content, metadata } of emitted) {
      expect(content.fields.title).toMatch(
        /^[^|]+출장마사지 [^|]+출장안마 \| .+ · 마사지러브$/u,
      );
      expect(metadata).toMatchObject({
        title: { absolute: content.fields.title },
        description: content.fields.description,
        keywords: content.fields.keywords,
        alternates: { canonical: absoluteUrl(`${node.path}/`) },
        openGraph: {
          title: content.fields.title,
          description: content.fields.description,
        },
        twitter: {
          title: content.fields.title,
          description: content.fields.description,
        },
      });
    }
  }, 30_000);
});
