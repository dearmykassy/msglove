import { describe, expect, it } from "vitest";
import { metadata as homeMetadata } from "@/app/page";
import { generateMetadata as generateRegionMetadata } from "@/app/areas/[...segments]/page";
import { createRegionContent } from "@/lib/region-content";
import {
  ACTIVE_REGION_NODES,
  getKeywordRegionLabel,
  OFFICIAL_ADMINISTRATIVE_REGION_NAMES,
  shortenKnownAdministrativeRegionNames,
} from "@/lib/regions";
import { absoluteUrl } from "@/lib/site-config";
import { HOME_COPY } from "@/lib/visible-content";

const ON_CALL_MASSAGE = "\uCD9C\uC7A5\uC548\uB9C8";

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

  it("emits concise, unique regional metadata for all 1,291 routes", async () => {
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
    expect(new Set(emitted.map(({ content }) => content.fields.description)).size).toBe(1291);
    expect(new Set(emitted.map(({ content }) => content.fields.keywords.join("\u0000"))).size).toBe(1291);

    const serviceKeywords = [
      "출장마사지",
      ON_CALL_MASSAGE,
      "출장타이마사지",
      "출장스웨디시",
      "출장홈타이",
      "토닥이",
      "남성전용마사지",
      "여성전용마사지",
    ];
    const forbiddenFormalTarget = new RegExp(
      `(?:${OFFICIAL_ADMINISTRATIVE_REGION_NAMES
        .filter((name) => shortenKnownAdministrativeRegionNames(name) !== name)
        .sort((left, right) => right.length - left.length)
        .map((name) => name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"))
        .join("|")})\\s*(?=${serviceKeywords.join("|")})`,
      "u",
    );

    for (const { node, content, metadata } of emitted) {
      const searchLabel = getKeywordRegionLabel(node);
      expect(content.fields.title).toMatch(
        new RegExp(`^[^|]+출장마사지 [^|]+${ON_CALL_MASSAGE} \\| .+ · 마사지러브$`, "u"),
      );
      expect(
        content.fields.title.startsWith(
          `${searchLabel}출장마사지 ${searchLabel}${ON_CALL_MASSAGE}`,
        ),
      ).toBe(true);
      for (const [fieldName, values] of [
        ["title", [content.fields.title]],
        ["description", [content.fields.description]],
        ["keywords", content.fields.keywords],
      ] as const) {
        for (const value of values) {
          expect(value, `${node.path} ${fieldName}`).not.toMatch(forbiddenFormalTarget);
          expect(shortenKnownAdministrativeRegionNames(value), `${node.path} ${fieldName}`).toBe(value);
        }
      }
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

    const suwon = emitted.find(
      ({ node }) => node.path === "/areas/gyeonggi/%EC%88%98%EC%9B%90%EC%8B%9C",
    );
    expect(suwon).toBeDefined();
    expect(suwon?.content.fields.title).toContain(`수원출장마사지 수원${ON_CALL_MASSAGE}`);
    expect(suwon?.content.fields.description).toContain("수원출장마사지");
    expect(suwon?.content.fields.h1).toContain("수원시");
    expect(suwon?.content.heroLead).toContain("수원시");
    expect(suwon?.metadata.alternates?.canonical).toBe(
      absoluteUrl("/areas/gyeonggi/%EC%88%98%EC%9B%90%EC%8B%9C/"),
    );
  }, 30_000);
});
