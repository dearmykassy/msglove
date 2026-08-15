import { describe, expect, it } from "vitest";
import { BUSINESS, COURSE_PRICING, PRICE_ITEM_COUNT } from "@/data/business";

describe("verified shared operating facts", () => {
  it("uses the approved phone and payment facts", () => {
    expect(BUSINESS.phoneDisplay).toBe("0508-202-3906");
    expect(BUSINESS.phoneHref).toBe("tel:05082023906");
    expect(BUSINESS.phoneCtaLabel).toBe("전화상담");
    expect(BUSINESS.consultation).toBe("24시간 전화상담");
    expect(BUSINESS.payment).toBe("선입금 없는 100% 현장 후불");
    expect(BUSINESS.cardPayment).toBe("현장 카드 결제 가능");
  });

  it("keeps the final five-course, fourteen-item price ledger", () => {
    expect(COURSE_PRICING).toHaveLength(5);
    expect(PRICE_ITEM_COUNT).toBe(14);
    expect(COURSE_PRICING[0].items[0]).toEqual({ minutes: 60, price: 80_000 });
    expect(COURSE_PRICING[4].items[1]).toEqual({ minutes: 90, price: 150_000 });
  });
});
