import { describe, expect, it } from "vitest";
import { buildContentQualityReceipt } from "@/lib/content-quality";
import { REGION_CONTENT, REGION_KEYWORD_SUFFIXES } from "@/lib/region-content";
import { ACTIVE_REGION_NODES, getKeywordRegionLabel } from "@/lib/regions";

describe("MassageLove same-route regional snapshot", () => {
  it("joins every active MassageBom route by the canonical path", () => {
    expect(REGION_CONTENT).toHaveLength(1291);
    expect(new Set(REGION_CONTENT.map((entry) => entry.route)).size).toBe(1291);
    expect(new Set(ACTIVE_REGION_NODES.map((entry) => entry.path))).toEqual(
      new Set(REGION_CONTENT.map((entry) => entry.route)),
    );
  });

  it("keeps metadata and per-route commercial names unique", () => {
    for (const values of [
      REGION_CONTENT.map((entry) => entry.fields.title),
      REGION_CONTENT.map((entry) => entry.fields.description),
      REGION_CONTENT.map((entry) => entry.fields.h1),
      REGION_CONTENT.map((entry) => entry.commercialName),
    ]) {
      expect(new Set(values).size).toBe(1291);
    }
    for (const entry of REGION_CONTENT) {
      expect(entry.fields.h1).toBe(entry.commercialName);
      expect(entry.commercialName).toMatch(
        /^.+\s+\S+\s+(출장마사지|홈타이|타이마사지|스웨디시|마사지)$/u,
      );
    }
  });

  it("uses the exact owner-required eight keyword intents", () => {
    for (const node of ACTIVE_REGION_NODES) {
      const entry = REGION_CONTENT.find((content) => content.route === node.path);
      expect(entry).toBeDefined();
      expect(entry?.fields.keywords).toEqual(
        REGION_KEYWORD_SUFFIXES.map(
          (suffix) => `${getKeywordRegionLabel(node)}${suffix}`,
        ),
      );
    }
  });

  it("retains only approved exact shared facts", () => {
    for (const entry of REGION_CONTENT) {
      expect(entry.exactShared.contact).toEqual({
        domestic: "05082023906",
        display: "0508-202-3906",
        e164: "+825082023906",
        telHref: "tel:05082023906",
      });
      expect(
        entry.exactShared.pricing.reduce((count, course) => count + course.options.length, 0),
      ).toBe(14);
      expect(entry.faq.items).toHaveLength(7);
    }
  });

  it("does not restore forbidden wrapper copy or source-brand leakage", () => {
    const corpus = JSON.stringify(REGION_CONTENT);
    for (const forbidden of [
      "마사지봄",
      "[object Object]",
      "이용 정보를 따라",
      "마사지러브 안내를 기준으로",
      "지역 안내에서",
    ]) {
      expect(corpus).not.toContain(forbidden);
    }
  });

  it("passes the fast source-level regional contract", () => {
    const receipt = buildContentQualityReceipt();
    expect(receipt.status).toBe("PASS");
    expect(receipt.violations).toEqual([]);
    expect(receipt.routeJoin.missing).toEqual([]);
    expect(receipt.counts.sourceVisibleRoutes).toBe(1301);
  }, 60_000);
});
