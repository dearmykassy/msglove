export type BlogSection = {
  heading: string;
  paragraphs: readonly string[];
};

export type BlogPost = {
  slug: string;
  route: string;
  order: number;
  eyebrow: string;
  metadataTitle: string;
  metadataDescription: string;
  cardTitle: string;
  h1: string;
  heroParagraph: string;
  sections: readonly BlogSection[];
  consultationHeading: string;
  consultationItems: readonly string[];
  publishedAt: string;
  modifiedAt: string;
};

// Verified from the repository's initial production release commit
// dc5054dbfaa10246a63a245e5fb1f5351a38b8a8. Do not replace this with build time.
const BLOG_RELEASED_AT = "2026-08-15T13:13:24+09:00";

export const BLOG_HUB_COPY = {
  metadataTitle: "방문 상담 블로그",
  metadataDescription:
    "마사지러브의 지역 확인, 전화상담 준비, 방문형 이용 전 체크 항목을 차분히 정리한 실용 안내입니다.",
  eyebrow: "MASSAGE LOVE JOURNAL",
  h1: "방문 상담 전에 읽는 실용 안내",
  heroParagraph:
    "이용 장소와 희망 조건을 정리할 때 필요한 내용을 짧고 분명하게 모았습니다.",
  listEyebrow: "GUIDE BOARD",
  listHeading: "지금 필요한 내용을 골라 보세요",
  listParagraph:
    "각 글은 지역 안내와 전화상담으로 이어지는 확인 순서를 중심으로 작성했습니다.",
  readCta: "글 읽기",
} as const;

export const BLOG_POSTS = [
  {
    slug: "masaji-shop-gagi-himdeul-ttae",
    route: "/blog/masaji-shop-gagi-himdeul-ttae/",
    order: 1,
    eyebrow: "VISITATION NOTE 01",
    metadataTitle: "샵에 나가기 버거운 날, 전화상담을 정리하는 법",
    metadataDescription:
      "샵 방문이 부담스러운 날, 방문형 이용을 전화로 확인할 때 주소·희망 시간·코스·결제 기준을 정리하는 방법.",
    cardTitle: "샵에 가기 버거운 날, 상담을 정리하는 순서",
    h1: "피곤한 날에는 이동보다 상담 조건부터 정리하세요",
    heroParagraph:
      "샵까지 나갈 힘이 부족한 날에는 선택을 서두르기보다, 이용할 장소와 조건을 짧게 적어 전화로 확인해 보세요.",
    sections: [
      {
        heading: "관리보다 왕복이 더 크게 느껴지는 날",
        paragraphs: [
          "피로가 쌓인 날에는 관리 시간보다 매장까지 오가는 과정과 기다릴 수 있는 여유가 더 크게 느껴집니다. 이럴 때는 샵 방문과 방문형 이용이 어디에서 이뤄지는지부터 구분해 두면 선택이 단순해집니다.",
          "방문형 이용은 전화상담으로 확인한 장소에서 받는 방식입니다. 장소를 먼저 떠올려 보면 오늘 일정에 맞는지, 무엇을 질문해야 하는지도 차분히 정리할 수 있습니다.",
        ],
      },
      {
        heading: "장소를 정했다면 주소부터 정확히",
        paragraphs: [
          "상담에서 가장 먼저 필요한 것은 서비스를 받을 정확한 주소입니다. 도로명과 건물명, 필요한 출입 정보를 준비하면 지역 안내와 함께 방문 가능 여부를 확인하는 데 도움이 됩니다.",
          "자택이나 숙소처럼 머무는 곳이 아니라 실제로 서비스를 받을 곳을 기준으로 말해 주세요. 주소가 바뀌었거나 세부 사항이 정리되지 않았다면, 통화에서 확인할 항목으로 남기는 편이 정확합니다.",
        ],
      },
      {
        heading: "시간과 코스는 후보로 남기기",
        paragraphs: [
          "희망 시간은 한 시각만 적기보다 조정할 수 있는 범위를 함께 정리해 두세요. 시간과 장소가 확정되지 않은 상태에서 가능하다고 단정하지 않는 것이 서로의 확인을 간단하게 만듭니다.",
          "코스는 가격표를 보고 한두 가지 후보와 이용 시간을 메모하면 충분합니다. 마사지러브 가격 안내에서 시간과 금액을 비교한 뒤, 상담에서 해당 조건을 전달해 확인할 수 있습니다.",
        ],
      },
      {
        heading: "결제 기준까지 확인하고 마무리",
        paragraphs: [
          "결제 기준도 미리 알고 있으면 통화가 더 분명해집니다. 마사지러브는 24시간 전화상담을 운영하며, 선입금 없는 100% 현장 후불과 현장 카드 결제 가능 기준을 안내합니다.",
          "카드 결제를 원한다면 통화 중에 함께 말하고, 마지막에는 주소·희망 시간·코스 후보를 다시 확인해 보세요. 이동이 부담스러운 날일수록 한 번의 통화에 필요한 정보를 모아 두는 것이 편합니다.",
        ],
      },
    ],
    consultationHeading: "전화 전에 적어 둘 세 가지",
    consultationItems: [
      "서비스를 받을 정확한 주소와 필요한 출입 정보",
      "희망 시간과 조정할 수 있는 시간 범위",
      "비교해 둔 코스와 현장 카드 결제 여부",
    ],
    publishedAt: BLOG_RELEASED_AT,
    modifiedAt: BLOG_RELEASED_AT,
  },
  {
    slug: "jibeseo-masaji-badeul-su-issnayo",
    route: "/blog/jibeseo-masaji-badeul-su-issnayo/",
    order: 2,
    eyebrow: "HOME CHECK 02",
    metadataTitle: "집에서 받을 수 있을지, 전화 전에 준비할 네 가지",
    metadataDescription:
      "자택이나 숙소에서 방문형 이용을 상담할 때 장소·출입 정보·희망 시간·코스·결제 기준을 정리하는 실용 안내.",
    cardTitle: "집이나 숙소에서 이용하기 전, 준비할 내용",
    h1: "집이나 숙소에서 이용하려면 받을 장소를 먼저 정리하세요",
    heroParagraph:
      "집에서 받을 수 있는지 궁금하다면, 장소와 희망 조건을 미리 정리한 뒤 전화상담에서 확인하는 순서가 좋습니다.",
    sections: [
      {
        heading: "이용 장소는 먼저 상담할 내용입니다",
        paragraphs: [
          "자택이나 숙소를 이용 장소로 생각하고 있다면, 장소 이름만으로 가능하다고 단정하기보다 전화에서 조건을 확인해 보세요. 방문형 이용은 상담한 장소와 희망 시간을 바탕으로 이용 가능 여부를 살피는 방식입니다.",
          "서비스를 받을 정확한 주소가 정리되면 지역 안내를 함께 확인하기 수월합니다. 지역이 바뀌었을 때는 이전에 말한 내용보다 새 주소를 먼저 전달하는 편이 상담 내용을 분명하게 만듭니다.",
        ],
      },
      {
        heading: "출입에 필요한 정보도 함께 남기기",
        paragraphs: [
          "도로명과 건물명 외에 출입에 필요한 정보가 있다면 통화 전에 메모해 두세요. 처음부터 모든 조건을 혼자 판단할 필요는 없고, 확인이 필요한 부분은 전화상담에서 그대로 질문하면 됩니다.",
          "공간에 관한 걱정도 추측으로 결론내리기보다 이용 장소를 설명하며 확인해 보세요. 주소와 출입 정보가 바뀌면 상담 내용도 달라질 수 있으므로, 마지막에 한 번 더 맞춰 보는 것이 좋습니다.",
        ],
      },
      {
        heading: "희망 시간과 코스는 짧게 고르기",
        paragraphs: [
          "원하는 시간은 일정에 맞춰 가능한 범위까지 적어 두고, 코스는 가격표에서 비교한 후보를 한두 개만 남겨 보세요. 긴 설명보다 희망 시간과 이용 시간을 함께 말하는 편이 질문의 순서를 정리하는 데 도움이 됩니다.",
          "가격 안내에는 코스별 시간과 금액이 공개되어 있습니다. 통화 전 가격을 확인한 뒤 원하는 코스와 이용 시간을 전달하면, 지역과 시간에 관한 확인을 이어가기 편합니다.",
        ],
      },
      {
        heading: "결제 방식까지 메모하면 상담이 선명해집니다",
        paragraphs: [
          "마사지러브는 24시간 전화상담을 운영합니다. 선입금 없는 100% 현장 후불을 기준으로 안내하고 있으며, 현장 카드 결제를 원한다면 전화할 때 함께 알려 주세요.",
          "통화를 마칠 때는 이용 장소, 희망 시간, 코스 후보, 결제 관련 요청을 한 줄씩 다시 확인해 보세요. 집이나 숙소에서 이용할지 고민하는 단계라면, 이 네 가지가 정리된 뒤에 지역 안내와 상담으로 이어가는 편이 실용적입니다.",
        ],
      },
    ],
    consultationHeading: "집이나 숙소 상담에 남길 네 가지",
    consultationItems: [
      "실제로 서비스를 받을 주소와 건물명",
      "출입에 필요한 정보와 확인할 질문",
      "희망 시간 범위와 코스·이용 시간 후보",
      "현장 카드 결제를 원하는지 여부",
    ],
    publishedAt: BLOG_RELEASED_AT,
    modifiedAt: BLOG_RELEASED_AT,
  },
] as const satisfies readonly BlogPost[];

export function getBlogPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((post) => post.slug === slug);
}

export function blogPostCharacterCount(post: BlogPost): number {
  return Array.from(
    [
      post.heroParagraph,
      ...post.sections.flatMap((section) => [section.heading, ...section.paragraphs]),
    ].join(""),
  ).length;
}
