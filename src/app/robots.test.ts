import { describe, expect, it } from "vitest";
import robots from "@/app/robots";

describe("production robots policy", () => {
  it("allows crawling and advertises the production sitemap", () => {
    expect(robots()).toEqual({
      rules: { userAgent: "*", allow: "/" },
      sitemap: "https://msglove.kr/sitemap.xml",
    });
  });
});
