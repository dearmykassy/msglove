import { describe, expect, it } from "vitest";

import {
  buildPhoneCtaEventParams,
  buildPageViewParams,
  deriveCtaLocation,
  GA_CONFIG_PARAMS,
  inferPageType,
  normalizeGaMeasurementId,
  normalizePagePath,
  normalizePageTitle,
} from "./analytics";

describe("analytics contract", () => {
  it("keeps GA loading opt-in and validates the measurement ID", () => {
    expect(normalizeGaMeasurementId(undefined)).toBeNull();
    expect(normalizeGaMeasurementId(" g-abc123def4 ")).toBe("G-ABC123DEF4");
    expect(normalizeGaMeasurementId('G-ABC123\" onload=alert(1)')).toBeNull();
  });

  it("disables automatic page views and advertising signals", () => {
    expect(GA_CONFIG_PARAMS).toEqual({
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
  });

  it("omits query strings and redacts obvious PII from page paths", () => {
    expect(normalizePagePath("/areas/seoul/?utm_source=test#hero")).toBe(
      "/areas/seoul",
    );
    expect(normalizePagePath("/call/0508-1234-5678")).toBe("/call/[redacted]");
    expect(normalizePagePath("/member/person@example.com")).toBe(
      "/member/[redacted]",
    );
    expect(inferPageType("/areas/seoul")).toBe("region");
    expect(inferPageType("/love-select")).toBe("editorial");
    expect(inferPageType("/unknown")).toBeUndefined();
  });

  it("builds a clean location and redacted bounded title for page views", () => {
    const params = buildPageViewParams(
      "massage-love",
      "/areas/seoul?utm_source=test#hero",
      {
        origin: "https://msglove.kr/ignored/path",
        title: `고객 person@example.com · 0508-1234-5678 ${"가".repeat(200)}`,
      },
    );

    expect(params.page_location).toBe("https://msglove.kr/areas/seoul");
    expect(params.page_title).not.toContain("person@example.com");
    expect(params.page_title).not.toContain("0508");
    expect(params.page_title).toHaveLength(150);
    expect(normalizePageTitle("  정상   제목  ")).toBe("정상 제목");
  });

  it("uses a controlled CTA category instead of raw text", () => {
    expect(deriveCtaLocation("region_hero", "0508-1234-5678")).toBe(
      "region_hero",
    );
    expect(
      deriveCtaLocation(undefined, "지금 전화상담 0508-1234-5678"),
    ).toBe("phone_consultation");
    expect(deriveCtaLocation(undefined, "0508-1234-5678")).toBe("tel_link");
  });

  it("keeps phone hrefs, numbers and raw labels out of CTA payloads", () => {
    const params = buildPhoneCtaEventParams({
      platformId: "massage-love",
      path: "/areas/seoul?customer=person@example.com",
      dataLocation: "region_floating",
      textContent: "전화상담 0508-1234-5678",
      context: {
        origin: "https://msglove.kr/path?private=0508-1234-5678",
        title: "고객 person@example.com · 0508-1234-5678",
      },
    });
    const serialized = JSON.stringify(params);

    expect(Object.keys(params).sort()).toEqual([
      "cta_location",
      "page_location",
      "page_path",
      "page_title",
      "page_type",
      "platform_id",
      "transport_type",
    ]);
    expect(params.transport_type).toBe("beacon");
    expect(serialized).not.toContain("0508");
    expect(serialized).not.toContain("tel:");
    expect(serialized).not.toContain("person@example.com");
    expect(params.page_location).toBe("https://msglove.kr/areas/seoul");
  });
});
