import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ROOT_REGION_CARD_IMAGES } from "@/data/root-region-card-images";
import { ACTIVE_ROOT_KEYS, type ActiveRootKey } from "@/lib/regions";
import { RootRegionGrid } from "@/components/RootRegionGrid";

type RootCardProvenance = {
  derivative: {
    format: string;
    width: number;
    height: number;
    quality: number;
  };
  assets: Array<{
    rootKey: ActiveRootKey;
    assetPath: string;
    sha256: string;
    alt: string;
    source: {
      pageUrl: string;
      author: string;
      license: string;
      licenseUrl: string;
    };
  }>;
};

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PROVENANCE_PATH = path.join(
  PROJECT_ROOT,
  "public/images/massage-love-root-regions/v1/provenance.json",
);

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

describe("homepage root-region photography", () => {
  it("binds exactly one descriptive asset to each active root", () => {
    expect(Object.keys(ROOT_REGION_CARD_IMAGES)).toEqual([...ACTIVE_ROOT_KEYS]);
    expect(new Set(Object.values(ROOT_REGION_CARD_IMAGES).map((image) => image.src)).size).toBe(
      ACTIVE_ROOT_KEYS.length,
    );

    for (const rootKey of ACTIVE_ROOT_KEYS) {
      const image = ROOT_REGION_CARD_IMAGES[rootKey];
      expect(image.src).toBe(
        `/images/massage-love-root-regions/v1/${rootKey}.webp`,
      );
      expect(image.width).toBe(1200);
      expect(image.height).toBe(720);
      expect(image.alt.trim()).not.toHaveLength(0);
      expect(image.sha256).toMatch(/^[a-f0-9]{64}$/u);
    }
  });

  it("renders lazy, descriptive images on the homepage grid only", () => {
    const homeMarkup = renderToStaticMarkup(<RootRegionGrid variant="home" />);
    const directoryMarkup = renderToStaticMarkup(<RootRegionGrid />);

    expect(homeMarkup.match(/<img\b/gu)).toHaveLength(ACTIVE_ROOT_KEYS.length);
    expect(homeMarkup.match(/loading="lazy"/gu)).toHaveLength(ACTIVE_ROOT_KEYS.length);
    expect(directoryMarkup).not.toContain("/images/massage-love-root-regions/");
    expect(directoryMarkup).not.toMatch(/<img\b/gu);

    for (const rootKey of ACTIVE_ROOT_KEYS) {
      const image = ROOT_REGION_CARD_IMAGES[rootKey];
      expect(homeMarkup).toContain(`src="${image.src}"`);
      expect(homeMarkup).toContain(`alt="${image.alt}"`);
      expect(homeMarkup).toContain('width="1200"');
      expect(homeMarkup).toContain('height="720"');
    }
  });

  it("keeps public assets and source provenance in lockstep", async () => {
    const provenance = JSON.parse(
      await readFile(PROVENANCE_PATH, "utf8"),
    ) as RootCardProvenance;

    expect(provenance.derivative).toMatchObject({
      format: "WebP",
      width: 1200,
      height: 720,
      quality: 82,
    });
    expect(provenance.assets.map((asset) => asset.rootKey)).toEqual([...ACTIVE_ROOT_KEYS]);

    for (const asset of provenance.assets) {
      const image = ROOT_REGION_CARD_IMAGES[asset.rootKey];
      expect(asset.assetPath).toBe(image.src);
      expect(asset.sha256).toBe(image.sha256);
      expect(asset.alt).toBe(image.alt);
      expect(asset.source.pageUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/u);
      expect(asset.source.author.trim()).not.toHaveLength(0);
      expect(asset.source.license.trim()).not.toHaveLength(0);
      expect(asset.source.licenseUrl).toMatch(/^https:\/\//u);

      const publicPath = path.join(
        PROJECT_ROOT,
        "public",
        asset.assetPath.replace(/^\//u, ""),
      );
      const bytes = await readFile(publicPath);
      expect((await stat(publicPath)).size).toBeGreaterThan(0);
      expect(sha256(bytes)).toBe(asset.sha256);
    }
  });
});
