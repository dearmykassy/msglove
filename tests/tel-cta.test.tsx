import { describe, expect, it } from "vitest";
import { BUSINESS } from "@/data/business";
import { buildSourceRouteMarkups } from "@/lib/rendered-route-contract";
import { normalizeVisibleDomValue } from "@/lib/visible-dom-contract";

function anchorText(markup: string): string {
  return normalizeVisibleDomValue(markup.replace(/<[^>]+>/gu, ""));
}

describe("telephone CTA contract", () => {
  it("labels every actual telephone link exactly 전화상담 on every route", () => {
    const routes = buildSourceRouteMarkups();
    let telephoneLinks = 0;

    for (const route of routes) {
      const anchors = [...route.markup.matchAll(
        /<a\b[^>]*href="tel:[^"]+"[^>]*>([\s\S]*?)<\/a>/gu,
      )];
      expect(anchors.length, route.route).toBeGreaterThan(0);
      for (const anchor of anchors) {
        telephoneLinks += 1;
        expect(anchorText(anchor[1]), route.route).toBe(BUSINESS.phoneCtaLabel);
      }
    }

    expect(routes).toHaveLength(1301);
    expect(telephoneLinks).toBe(5192);
  }, 20_000);
});
