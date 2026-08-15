import { BUSINESS, COURSE_PRICING } from "@/data/business";
import { BLOG_HUB_COPY, BLOG_POSTS } from "@/data/blog";
import { getDirectChildren, type RegionNode } from "@/lib/regions";

export type VisibleContentFields = {
  title: string;
  description: string;
  keywords?: string[];
  h1: string;
  eyebrow: string;
  headings: string[];
  paragraphs: string[];
  ctaLabels: string[];
  labels: string[];
};

export type FixedVisibleContentEntry = {
  route: string;
  pageType: "fixed-page" | "site-common";
  fields: VisibleContentFields;
};

export const SITE_COPY = {
  defaultTitle: "마사지러브 | 저녁을 정돈하는 방문 상담 라운지",
  defaultDescription:
    "지역별 방문 가능 여부와 시간별 코스·가격을 확인하고 24시간 전화로 일정을 상담하세요.",
  brandAriaLabel: "마사지러브 홈",
  desktopNavigationAriaLabel: "주요 메뉴",
  mobileNavigationAriaLabel: "모바일 메뉴",
  mobileMenuLabel: "메뉴",
  navigation: [
    { href: "/areas/", label: "지역 안내" },
    { href: "/pricing/", label: "가격 안내" },
    { href: "/blog/", label: "블로그" },
    { href: "/notice/", label: "공지사항" },
  ],
  footerDescription: "저녁의 일정과 선택을 차분하게 연결하는 방문 상담 라운지.",
  footerServiceHeading: "서비스",
  footerEditorialHeading: "에디토리얼",
  footerPhoneHeading: "24시간 상담 창구",
} as const;

export const HOME_COPY = {
  metadataTitle: "마사지러브 | 전국 출장 마사지 · 지역별 코스·가격 안내",
  metadataDescription:
    "마사지러브 운영 지역, 코스별 가격, 현장 후불과 카드 결제 기준을 한곳에서 확인하세요.",
  metadataKeywords: [
    "마사지러브",
    "전국 출장 마사지",
    "지역별 출장 마사지",
    "24시간 상담",
  ],
  eyebrow: "마사지러브 지역 안내",
  h1: "전국 출장 마사지",
  heroParagraph:
    "원하는 지역과 코스를 한눈에 확인하고, 전국 어디서든 24시간 상담받으세요.",
  primaryCta: "내 지역 찾기",
  secondaryCta: BUSINESS.phoneCtaLabel,
  heroFacts: ["24시간 상담", "선입금 없는 현장 후불", "현장 카드 결제"],
  searchEyebrow: "지역 검색",
  searchHeading: "내 지역 찾기",
  searchPlaceholder: "예: 강남구, 송도동",
  regionEyebrow: "서비스 지역",
  regionHeading: "우리 지역 찾기",
  regionParagraph:
    "운영 지역에서 원하는 지역을 선택해 안내를 확인하세요.",
  regionCardLabel: "지역 안내",
  pricingEyebrow: "가격 안내",
  pricingHeading: "코스별 시간과 가격을 확인하세요.",
  pricingParagraph: "코스별 이용 시간과 가격을 확인한 뒤 필요한 안내는 전화상담으로 이어가세요.",
  pricingCta: BUSINESS.phoneCtaLabel,
  principleEyebrow: "이용 안내",
  principleHeading: "세 가지 운영 원칙",
  principles: [
    {
      title: "지역을 먼저 확인",
      body: "원하는 지역을 선택해 안내를 확인합니다.",
    },
    {
      title: "24시간 상담",
      body: "필요한 안내는 전화상담으로 확인할 수 있습니다.",
    },
    {
      title: "현장 결제",
      body: "선입금 없는 현장 후불과 현장 카드 결제가 가능합니다.",
    },
  ],
} as const;

export const AREAS_COPY = {
  metadataTitle: "지역 라운지",
  metadataDescription:
    "마사지러브가 상담하는 11개 운영 권역에서 서비스를 받을 지역을 찾아보세요.",
  eyebrow: "REGION LOUNGE · 11 AREAS",
  h1: "서비스를 받을 도시를 선택하세요",
  heroParagraph:
    "시·구·동의 순서로 이동하며 서비스를 받을 정확한 주소에 맞는 상담 페이지를 찾을 수 있습니다.",
  directoryEyebrow: "LOVE REGION INDEX",
  directoryHeading: "방문 주소가 속한 운영 권역을 찾아보세요",
  directoryParagraph:
    "먼저 광역 권역을 고른 뒤 시·구·동 페이지로 이동하면 상담에 필요한 정보를 확인할 수 있습니다.",
} as const;

export const PRICING_COPY = {
  metadataTitle: "코스 라인업과 가격",
  metadataDescription: "마사지러브의 5개 코스와 14개 시간별 가격을 확인하세요.",
  eyebrow: "COURSE LEDGER · OPEN PRICE",
  h1: "시간과 금액이 먼저 보이는 코스표",
  heroParagraph: "종류·진행 시간·금액을 비교하고 상담에서 방문 일정을 확인하세요.",
  ledgerEyebrow: "FIVE COURSES · FOURTEEN PRICES",
  ledgerHeading: "이용 시간과 금액을 나란히 비교해 보세요",
  ledgerParagraph:
    "남은 시간과 예산을 먼저 정하면 전화상담에서 확인할 코스 후보를 간단히 추릴 수 있습니다.",
  calloutEyebrow: "24H PHONE DESK",
  calloutHeading: "선택한 코스와 방문 지역을 전화로 알려 주세요",
  calloutParagraph:
    "방문 가능 여부는 서비스를 받을 정확한 주소와 희망 시간에 따라 상담에서 확인합니다.",
} as const;

export const GUIDE_COPY = {
  metadataTitle: "이용 방식",
  metadataDescription: "지역 확인부터 현장 후불 결제까지 마사지러브 이용 순서를 확인하세요.",
  eyebrow: "HOW IT FLOWS",
  h1: "전화 한 통 전에 알아둘 네 단계",
  heroParagraph:
    "조건을 먼저 확인하고 동의한 일정만 진행할 수 있도록 순서를 단순하게 만들었습니다.",
  steps: [
    ["01", "방문 지역 찾기", "지역 라운지에서 서비스를 받을 주소가 속한 시·구·동을 찾습니다."],
    ["02", "조건 전달", "정확한 방문 주소, 희망 시간, 코스와 길이를 알려 주세요."],
    ["03", "일정 확인", "지역별 방문 가능 여부와 결제 방법을 확인합니다."],
    ["04", "현장 결제", "이용이 끝난 다음 예약금을 따로 보내지 않고 현장에서 비용을 냅니다."],
  ],
  calloutEyebrow: "READY TO CHECK?",
  calloutHeading: "서비스를 받을 지역과 희망 시간을 알려 주세요",
} as const;

export const LOVE_SELECT_COPY = {
  metadataTitle: "러브 셀렉트",
  metadataDescription:
    "남은 시간과 예산에 맞춰 마사지러브 코스를 고르는 실용적인 선택 기준을 확인하세요.",
  eyebrow: "LOVE SELECT",
  h1: "오늘 저녁에 맞는 코스를 고르는 순서",
  heroParagraph:
    "코스 이름부터 정하기보다 이용할 수 있는 시간과 예산을 먼저 살펴보면 선택이 간단해집니다.",
  sections: [
    {
      eyebrow: "FIRST FILTER",
      heading: "남은 시간을 먼저 계산해 보세요",
      paragraphs: [
        "약속 전후에 비워 둘 수 있는 시간을 확인하고 그보다 길지 않은 코스를 후보로 남겨 보세요.",
        "60분·90분·120분 가운데 무리 없는 길이를 고르면 이후 일정과 겹칠 가능성을 줄일 수 있습니다.",
      ],
    },
    {
      eyebrow: "SECOND FILTER",
      heading: "예산 안에서 두 가지 후보를 남겨 보세요",
      paragraphs: [
        "같은 이용 시간의 금액을 나란히 비교한 뒤 원하는 방식에 가까운 코스를 두 가지 정도 메모해 두세요.",
        "전화할 때 후보의 이름과 이용 시간을 함께 말하면 가능한 일정에 맞춰 확인하기 수월합니다.",
      ],
    },
    {
      eyebrow: "FINAL CHECK",
      heading: "주소와 결제 방법까지 맞으면 결정하세요",
      paragraphs: [
        "서비스를 받을 정확한 주소와 희망 시간을 전해야 실제 방문 가능 여부를 확인할 수 있습니다.",
        "비용은 선입금 없이 이용을 마친 뒤 현장에서 결제하며, 카드 결제를 원하면 통화에서 미리 알려 주세요.",
      ],
    },
  ],
  pricingCta: "코스별 가격 비교하기",
  phoneCta: BUSINESS.phoneCtaLabel,
} as const;

export const EVENING_NOTE_COPY = {
  metadataTitle: "이브닝 노트",
  metadataDescription:
    "방문 주소, 희망 시간, 코스와 결제 방법을 빠짐없이 정리하는 마사지러브 상담 메모.",
  eyebrow: "EVENING NOTE",
  h1: "전화 전에 네 줄만 메모해 두세요",
  heroParagraph:
    "서비스를 받을 주소와 희망 조건을 짧게 적어 두면 상담에서 같은 내용을 되풀이하지 않아도 됩니다.",
  checklistHeading: "전화할 때 곁에 둘 네 가지",
  checklist: [
    {
      title: "정확한 방문 주소",
      body: "시·군·구와 도로명, 건물명을 순서대로 적고 필요한 세부 주소는 통화에서 전달하세요.",
    },
    {
      title: "희망 시간 범위",
      body: "한 시각만 어렵다면 앞뒤로 조정할 수 있는 시간대도 함께 적어 두세요.",
    },
    {
      title: "코스 후보와 길이",
      body: "가격표에서 고른 코스 이름과 60분·90분·120분 중 원하는 길이를 기록하세요.",
    },
    {
      title: "현장에서 쓸 결제 수단",
      body: "카드 결제를 원한다면 방문 일정을 묻는 통화에서 미리 말씀해 주세요.",
    },
  ],
  changeHeading: "약속이 달라지면 바뀐 항목부터 알려 주세요",
  changeParagraphs: [
    "방문 주소나 희망 시간이 달라졌다면 이전 상담과 다른 내용을 먼저 말하고 가능한 일정을 다시 확인하세요.",
    "코스를 바꿀 때는 이용 시간과 금액도 함께 달라지는지 확인한 뒤 새 약속을 한 줄로 남겨 두면 됩니다.",
  ],
  phoneCta: BUSINESS.phoneCtaLabel,
} as const;

export const NOTICE_COPY = {
  metadataTitle: "공지사항",
  metadataDescription:
    "마사지러브의 24시간 전화상담, 선입금 없는 현장 후불, 현장 카드 결제 기준을 확인하세요.",
  eyebrow: "NOTICE BOARD",
  h1: "이용 전에 확인하는 운영 공지",
  heroParagraph: "상담과 결제에 관한 현재 기준을 짧고 분명하게 안내합니다.",
  boardEyebrow: "CURRENT OPERATING NOTES",
  boardHeading: "상담 전에 읽어 둘 세 가지",
  boardParagraph:
    "운영 사실을 임의로 넓혀 설명하지 않고, 현재 확인된 기준만 게시합니다.",
  items: [
    {
      label: "NOTICE 01",
      heading: "24시간 전화상담 안내",
      paragraphs: [
        "마사지러브 전화상담은 24시간 운영합니다.",
        "서비스를 받을 정확한 주소, 희망 시간, 원하는 코스를 전화로 알려 주시면 필요한 조건을 확인할 수 있습니다.",
      ],
    },
    {
      label: "NOTICE 02",
      heading: "선입금 없는 현장 후불 기준",
      paragraphs: [
        "비용은 선입금 없이 이용을 마친 뒤 현장에서 결제합니다.",
        "결제와 관련해 확인할 내용이 있다면 상담에서 함께 말씀해 주세요.",
      ],
    },
    {
      label: "NOTICE 03",
      heading: "현장 카드 결제 안내",
      paragraphs: [
        "현장 카드 결제가 가능합니다.",
        "카드 결제를 원한다면 전화상담에서 미리 알려 주세요.",
      ],
    },
  ],
} as const;

export const REGION_BREADCRUMB_ARIA_LABEL = "페이지 경로";

export const REGION_FACTS = [
  ["상담", "24H"],
  ["결제 시점", "현장 후불"],
  ["결제 수단", "카드 가능"],
] as const;

export const REGION_CALL_PREP = [
  "서비스를 받을 정확한 주소",
  "희망 시작 시간",
  "원하는 코스와 길이",
  "원하는 현장 결제 수단",
] as const;

export const REGION_PROCESS = [
  ["01", "주소와 시간 전달", "서비스를 받을 정확한 주소와 희망 시작 시간을 전화로 알려 주세요."],
  ["02", "코스·금액 확인", "공개 가격표를 기준으로 시간과 코스를 정합니다."],
  ["03", "방문 일정 조율", "지역별 가능한 일정을 통화에서 확인합니다."],
  ["04", "현장 후불 결제", "선입금 없이 서비스를 마친 뒤 현장에서 결제합니다."],
] as const;

export const REGION_STATIC_FAQS = [
  {
    question: "미리 입금해야 하나요?",
    answer: "아닙니다. 예약금을 먼저 보내지 않고 서비스를 마친 뒤 현장에서 결제합니다.",
  },
  {
    question: "카드 결제가 가능한가요?",
    answer: "현장 카드 결제가 가능합니다. 카드 결제를 원하면 전화상담에서 미리 알려 주세요.",
  },
  {
    question: "상담은 몇 시까지 가능한가요?",
    answer: "전화상담은 24시간 운영하며 지역별 방문 일정은 통화에서 확인합니다.",
  },
  {
    question: "어떤 정보를 먼저 말하면 되나요?",
    answer: "서비스를 받을 정확한 주소, 희망 시간, 원하는 코스와 길이를 알려 주시면 됩니다.",
  },
] as const;

export const REGION_EDITORIAL_LINKS = [
  {
    href: "/love-select/",
    eyebrow: "LOVE SELECT",
    title: "남은 시간에 맞는 코스 선택",
    body: "예산과 이용 시간을 기준으로 후보 코스를 두 가지까지 좁혀 봅니다.",
  },
  {
    href: "/evening-note/",
    eyebrow: "EVENING NOTE",
    title: "상담 내용을 남기는 네 줄 메모",
    body: "주소·시간·코스·결제 방법을 빠짐없이 전하는 순서를 확인하세요.",
  },
] as const;

export const REGION_LEAF_GUIDANCE = {
  eyebrow: "ADDRESS CHECK",
  paragraph:
    "서비스를 받을 정확한 주소의 도로명과 건물명을 준비한 뒤 전화로 방문 일정을 확인하세요.",
} as const;

export const REGION_BRANCH_GUIDANCE = {
  eyebrow: "LOCAL COORDINATES",
  paragraph:
    "서비스를 받을 시·구·동을 먼저 고른 뒤 해당 지역 페이지에서 상담 기준을 확인하세요.",
} as const;

export const REGION_ALIAS_ARIA_LABEL = "함께 쓰이는 주소 이름";

export function regionAvailabilityQuestion(node: RegionNode): string {
  return `${node.displayName} 방문 가능 여부는 어떻게 확인하나요?`;
}

export function getRegionSupplementalVisibleFields(node: RegionNode): {
  headings: string[];
  paragraphs: string[];
  labels: string[];
} {
  const children = getDirectChildren(node);
  const aliases = node.aliases.filter((alias) => alias !== node.displayName);
  const isLeaf = children.length === 0;
  return {
    headings: [
      ...REGION_PROCESS.map(([, title]) => title),
      regionAvailabilityQuestion(node),
      ...REGION_STATIC_FAQS.map((item) => item.question),
      ...REGION_EDITORIAL_LINKS.map((item) => item.title),
    ],
    paragraphs: [
      isLeaf ? REGION_LEAF_GUIDANCE.paragraph : REGION_BRANCH_GUIDANCE.paragraph,
      ...REGION_PROCESS.map(([, , body]) => body),
      ...REGION_STATIC_FAQS.map((item) => item.answer),
      ...REGION_EDITORIAL_LINKS.map((item) => item.body),
    ],
    labels: [
      REGION_BREADCRUMB_ARIA_LABEL,
      ...REGION_FACTS.flat(),
      ...REGION_CALL_PREP,
      isLeaf ? REGION_LEAF_GUIDANCE.eyebrow : REGION_BRANCH_GUIDANCE.eyebrow,
      ...(isLeaf && aliases.length > 0 ? [REGION_ALIAS_ARIA_LABEL] : []),
      BUSINESS.phoneCtaLabel,
      "CALL PREP",
      "VISIT FLOW",
      "QUICK ANSWERS",
    ],
  };
}

function courseLabels(): string[] {
  return COURSE_PRICING.flatMap((course) => [
    course.name,
    ...course.items.flatMap((item) => [
      `${item.minutes}분`,
      `${item.price.toLocaleString("ko-KR")}원`,
    ]),
  ]);
}

export const FIXED_VISIBLE_CONTENT: readonly FixedVisibleContentEntry[] = [
  {
    route: "__site-common__",
    pageType: "site-common",
    fields: {
      title: SITE_COPY.defaultTitle,
      description: SITE_COPY.defaultDescription,
      h1: BUSINESS.brand,
      eyebrow: SITE_COPY.brandAriaLabel,
      headings: [
        SITE_COPY.footerServiceHeading,
        SITE_COPY.footerEditorialHeading,
        SITE_COPY.footerPhoneHeading,
      ],
      paragraphs: [SITE_COPY.footerDescription],
      ctaLabels: [
        ...SITE_COPY.navigation.map((item) => item.label),
        BUSINESS.phoneCtaLabel,
      ],
      labels: [
        SITE_COPY.brandAriaLabel,
        SITE_COPY.desktopNavigationAriaLabel,
        SITE_COPY.mobileNavigationAriaLabel,
        SITE_COPY.mobileMenuLabel,
        BUSINESS.phoneDisplay,
        BUSINESS.consultation,
        BUSINESS.payment,
        ...courseLabels(),
      ],
    },
  },
  {
    route: "/",
    pageType: "fixed-page",
    fields: {
      title: HOME_COPY.metadataTitle,
      description: HOME_COPY.metadataDescription,
      keywords: [...HOME_COPY.metadataKeywords],
      h1: HOME_COPY.h1,
      eyebrow: HOME_COPY.eyebrow,
      headings: [
        HOME_COPY.searchHeading,
        HOME_COPY.regionHeading,
        HOME_COPY.pricingHeading,
        HOME_COPY.principleHeading,
        ...HOME_COPY.principles.map((item) => item.title),
      ],
      paragraphs: [
        HOME_COPY.heroParagraph,
        HOME_COPY.regionParagraph,
        HOME_COPY.pricingParagraph,
        ...HOME_COPY.principles.map((item) => item.body),
      ],
      ctaLabels: [HOME_COPY.primaryCta, HOME_COPY.secondaryCta, HOME_COPY.pricingCta],
      labels: [
        ...HOME_COPY.heroFacts,
        HOME_COPY.searchEyebrow,
        HOME_COPY.regionEyebrow,
        HOME_COPY.regionCardLabel,
        HOME_COPY.pricingEyebrow,
        HOME_COPY.principleEyebrow,
      ],
    },
  },
  {
    route: "/areas/",
    pageType: "fixed-page",
    fields: {
      title: AREAS_COPY.metadataTitle,
      description: AREAS_COPY.metadataDescription,
      h1: AREAS_COPY.h1,
      eyebrow: AREAS_COPY.eyebrow,
      headings: [AREAS_COPY.directoryHeading],
      paragraphs: [AREAS_COPY.heroParagraph, AREAS_COPY.directoryParagraph],
      ctaLabels: [],
      labels: [AREAS_COPY.directoryEyebrow],
    },
  },
  {
    route: "/pricing/",
    pageType: "fixed-page",
    fields: {
      title: PRICING_COPY.metadataTitle,
      description: PRICING_COPY.metadataDescription,
      h1: PRICING_COPY.h1,
      eyebrow: PRICING_COPY.eyebrow,
      headings: [PRICING_COPY.ledgerHeading, PRICING_COPY.calloutHeading],
      paragraphs: [
        PRICING_COPY.heroParagraph,
        PRICING_COPY.ledgerParagraph,
        PRICING_COPY.calloutParagraph,
      ],
      ctaLabels: [BUSINESS.phoneCtaLabel],
      labels: [PRICING_COPY.ledgerEyebrow, PRICING_COPY.calloutEyebrow],
    },
  },
  {
    route: "/guide/",
    pageType: "fixed-page",
    fields: {
      title: GUIDE_COPY.metadataTitle,
      description: GUIDE_COPY.metadataDescription,
      h1: GUIDE_COPY.h1,
      eyebrow: GUIDE_COPY.eyebrow,
      headings: [
        ...GUIDE_COPY.steps.map(([, title]) => title),
        GUIDE_COPY.calloutHeading,
      ],
      paragraphs: [
        GUIDE_COPY.heroParagraph,
        ...GUIDE_COPY.steps.map(([, , body]) => body),
        `${BUSINESS.consultation} · ${BUSINESS.payment} · ${BUSINESS.cardPayment}`,
      ],
      ctaLabels: [BUSINESS.phoneCtaLabel],
      labels: [GUIDE_COPY.calloutEyebrow],
    },
  },
  {
    route: "/love-select/",
    pageType: "fixed-page",
    fields: {
      title: LOVE_SELECT_COPY.metadataTitle,
      description: LOVE_SELECT_COPY.metadataDescription,
      h1: LOVE_SELECT_COPY.h1,
      eyebrow: LOVE_SELECT_COPY.eyebrow,
      headings: LOVE_SELECT_COPY.sections.map((section) => section.heading),
      paragraphs: [
        LOVE_SELECT_COPY.heroParagraph,
        ...LOVE_SELECT_COPY.sections.flatMap((section) => section.paragraphs),
      ],
      ctaLabels: [LOVE_SELECT_COPY.pricingCta, LOVE_SELECT_COPY.phoneCta],
      labels: LOVE_SELECT_COPY.sections.map((section) => section.eyebrow),
    },
  },
  {
    route: "/evening-note/",
    pageType: "fixed-page",
    fields: {
      title: EVENING_NOTE_COPY.metadataTitle,
      description: EVENING_NOTE_COPY.metadataDescription,
      h1: EVENING_NOTE_COPY.h1,
      eyebrow: EVENING_NOTE_COPY.eyebrow,
      headings: [
        EVENING_NOTE_COPY.checklistHeading,
        ...EVENING_NOTE_COPY.checklist.map((item) => item.title),
        EVENING_NOTE_COPY.changeHeading,
      ],
      paragraphs: [
        EVENING_NOTE_COPY.heroParagraph,
        ...EVENING_NOTE_COPY.checklist.map((item) => item.body),
        ...EVENING_NOTE_COPY.changeParagraphs,
      ],
      ctaLabels: [EVENING_NOTE_COPY.phoneCta],
      labels: [],
    },
  },
  {
    route: "/notice/",
    pageType: "fixed-page",
    fields: {
      title: NOTICE_COPY.metadataTitle,
      description: NOTICE_COPY.metadataDescription,
      h1: NOTICE_COPY.h1,
      eyebrow: NOTICE_COPY.eyebrow,
      headings: [NOTICE_COPY.boardHeading, ...NOTICE_COPY.items.map((item) => item.heading)],
      paragraphs: [
        NOTICE_COPY.heroParagraph,
        NOTICE_COPY.boardParagraph,
        ...NOTICE_COPY.items.flatMap((item) => item.paragraphs),
      ],
      ctaLabels: [],
      labels: [NOTICE_COPY.boardEyebrow, ...NOTICE_COPY.items.map((item) => item.label)],
    },
  },
  {
    route: "/blog/",
    pageType: "fixed-page",
    fields: {
      title: BLOG_HUB_COPY.metadataTitle,
      description: BLOG_HUB_COPY.metadataDescription,
      h1: BLOG_HUB_COPY.h1,
      eyebrow: BLOG_HUB_COPY.eyebrow,
      headings: [
        BLOG_HUB_COPY.listHeading,
        ...BLOG_POSTS.map((post) => post.cardTitle),
      ],
      paragraphs: [
        BLOG_HUB_COPY.heroParagraph,
        BLOG_HUB_COPY.listParagraph,
        ...BLOG_POSTS.map((post) => post.metadataDescription),
      ],
      ctaLabels: BLOG_POSTS.map(() => BLOG_HUB_COPY.readCta),
      labels: [BLOG_HUB_COPY.listEyebrow, ...BLOG_POSTS.map((post) => post.eyebrow)],
    },
  },
  ...BLOG_POSTS.map((post) => {
    const related = BLOG_POSTS.find((candidate) => candidate.slug !== post.slug);
    if (!related) throw new Error("MASSAGE_LOVE_BLOG_RELATED_POST_MISSING");
    return {
      route: post.route,
      pageType: "fixed-page" as const,
      fields: {
        title: post.metadataTitle,
        description: post.metadataDescription,
        h1: post.h1,
        eyebrow: post.eyebrow,
        headings: [
          post.consultationHeading,
          ...post.sections.map((section) => section.heading),
          "지역과 상담 조건을 차례로 확인하세요",
        ],
        paragraphs: [
          post.heroParagraph,
          ...post.consultationItems,
          ...post.sections.flatMap((section) => section.paragraphs),
          "지역 안내에서 서비스를 받을 곳을 찾은 뒤, 정확한 주소와 희망 조건을 전화상담으로 확인할 수 있습니다.",
        ],
        ctaLabels: ["지역 안내", BUSINESS.phoneCtaLabel, "관련 글 읽기"],
        labels: ["블로그 경로", "CALL NOTE", "CHECK NEXT", "RELATED READING", related.cardTitle],
      },
    };
  }),
] as const;

export function allFixedVisibleStrings(): string[] {
  return FIXED_VISIBLE_CONTENT.flatMap((entry) => [
    entry.fields.title,
    entry.fields.description,
    entry.fields.h1,
    entry.fields.eyebrow,
    ...entry.fields.headings,
    ...entry.fields.paragraphs,
    ...entry.fields.ctaLabels,
    ...entry.fields.labels,
  ]);
}
