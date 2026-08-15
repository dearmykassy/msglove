/** Owner-approved exact operational facts shared across every regional route. */
export const REGION_SHARED_EXACT = {
  contact: {
    domestic: "05082023906",
    display: "0508-202-3906",
    e164: "+825082023906",
    telHref: "tel:05082023906",
  },
  pricing: [
    {
      id: "thai",
      name: "타이마사지",
      description: "오일을 사용하지 않고 스트레칭과 지압을 중심으로 진행합니다.",
      options: [
        { minutes: 60, priceKrw: 80_000 },
        { minutes: 90, priceKrw: 100_000 },
        { minutes: 120, priceKrw: 120_000 },
      ],
    },
    {
      id: "aroma",
      name: "아로마마사지",
      description: "오일을 사용해 어깨와 등 라인을 부드럽게 관리하는 코스입니다.",
      options: [
        { minutes: 60, priceKrw: 90_000 },
        { minutes: 90, priceKrw: 110_000 },
        { minutes: 120, priceKrw: 130_000 },
      ],
    },
    {
      id: "healing",
      name: "힐링마사지",
      description: "강한 압보다 부드러운 진행을 선호할 때 살펴볼 수 있는 코스입니다.",
      options: [
        { minutes: 60, priceKrw: 100_000 },
        { minutes: 90, priceKrw: 120_000 },
        { minutes: 120, priceKrw: 140_000 },
      ],
    },
    {
      id: "special",
      name: "스페셜마사지",
      description: "부위별로 방식을 바꿔가며 진행하는 코스입니다.",
      options: [
        { minutes: 60, priceKrw: 110_000 },
        { minutes: 90, priceKrw: 130_000 },
        { minutes: 120, priceKrw: 150_000 },
      ],
    },
    {
      id: "male-only",
      name: "남성전용",
      description: "체격과 근육량을 고려해 비교적 높은 압으로 진행하는 코스입니다.",
      options: [
        { minutes: 60, priceKrw: 120_000 },
        { minutes: 90, priceKrw: 150_000 },
      ],
    },
  ],
  consultationItems: [
    { index: "01", title: "방문 지역", description: "시·군·구 또는 동 이름처럼 확인 가능한 지역명을 알려주세요." },
    { index: "02", title: "희망 시각", description: "이용을 원하는 날짜와 대략적인 시작 시각을 함께 알려주세요." },
    { index: "03", title: "코스와 시간", description: "가격표에서 원하는 코스와 이용 시간을 골라 알려주세요." },
    { index: "04", title: "이용 인원", description: "1인 이용인지, 커플·부부 2인 동시 관리인지 알려주세요." },
  ],
  serviceStandards: [
    { label: "PAYMENT 01", title: "100% 현장 후불", description: "사전 예약금 없이 관리가 끝난 뒤 현장에서 결제합니다." },
    { label: "PAYMENT 02", title: "현장 카드 결제", description: "무선 단말기를 이용한 현장 카드 결제가 가능합니다." },
    { label: "HOURS", title: "365일 24시간", description: "새벽 시간을 포함해 연중무휴로 상담과 운영을 이어갑니다." },
    { label: "PROGRAM", title: "2인 동시 관리", description: "커플·부부를 위한 2인 동시 관리 프로그램을 운영합니다." },
    { label: "HYGIENE", title: "일회용 비품·소독", description: "일회용 비품 사용과 관리 전후 소독 원칙을 준수합니다." },
    { label: "CONFIRMATION", title: "상담 내용 확인", description: "방문 가능 여부와 선택 코스, 이용 시간은 전화상담에서 안내합니다." },
  ],
  processSteps: [
    { title: "전화상담", description: "방문 지역과 희망 날짜·시각, 이용 인원을 알려주세요." },
    { title: "코스·시간 선택", description: "운영 가격표에서 원하는 코스와 이용 시간을 선택합니다." },
    { title: "예약 내용 확인", description: "방문 가능 여부와 선택 코스, 이용 시간을 확인합니다." },
    { title: "관리 진행", description: "예약에서 확인한 코스와 이용 시간에 맞춰 진행합니다." },
    { title: "현장 결제", description: "관리가 끝난 뒤 현장에서 현금 또는 카드로 결제합니다." },
  ],
} as const;
