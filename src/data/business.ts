export const BUSINESS = {
  brand: "마사지러브",
  platformId: "massage-love",
  phoneDisplay: "0508-202-3906",
  phoneHref: "tel:05082023906",
  phoneCtaLabel: "전화상담",
  consultation: "24시간 전화상담",
  payment: "선입금 없는 100% 현장 후불",
  cardPayment: "현장 카드 결제 가능",
} as const;

export const COURSE_PRICING = [
  {
    name: "타이",
    items: [
      { minutes: 60, price: 80_000 },
      { minutes: 90, price: 100_000 },
      { minutes: 120, price: 120_000 },
    ],
  },
  {
    name: "아로마",
    items: [
      { minutes: 60, price: 90_000 },
      { minutes: 90, price: 110_000 },
      { minutes: 120, price: 130_000 },
    ],
  },
  {
    name: "힐링",
    items: [
      { minutes: 60, price: 100_000 },
      { minutes: 90, price: 120_000 },
      { minutes: 120, price: 140_000 },
    ],
  },
  {
    name: "스페셜",
    items: [
      { minutes: 60, price: 110_000 },
      { minutes: 90, price: 130_000 },
      { minutes: 120, price: 150_000 },
    ],
  },
  {
    name: "남성전용",
    items: [
      { minutes: 60, price: 120_000 },
      { minutes: 90, price: 150_000 },
    ],
  },
] as const;

export const PRICE_ITEM_COUNT = COURSE_PRICING.reduce(
  (count, course) => count + course.items.length,
  0,
);
