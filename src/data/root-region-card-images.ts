import type { ActiveRootKey } from "@/lib/regions";

export type RootRegionCardImage = {
  src: string;
  width: 1200;
  height: 720;
  alt: string;
  objectPosition: string;
  sha256: string;
};

const ROOT_CARD_IMAGE_PATH = "/images/massage-love-root-regions/v1";

/**
 * Homepage-only photography for the 11 operating roots. Source and licence
 * records live beside the derived WebP assets in public/images.
 */
export const ROOT_REGION_CARD_IMAGES = {
  seoul: {
    src: `${ROOT_CARD_IMAGE_PATH}/seoul.webp`,
    width: 1200,
    height: 720,
    alt: "서울 도심의 야경과 스카이라인",
    objectPosition: "50% 54%",
    sha256: "c8198550953cb54b0af187a4f6f4a1a5f9361e0d3e370fc2c6b5ec7f002397b0",
  },
  incheon: {
    src: `${ROOT_CARD_IMAGE_PATH}/incheon.webp`,
    width: 1200,
    height: 720,
    alt: "밤에 빛나는 인천대교",
    objectPosition: "50% 50%",
    sha256: "e55d341937634f6d6fb1f6ae74003feeb46fb66e7dd84abe12f2cf32d3c6327d",
  },
  gyeonggi: {
    src: `${ROOT_CARD_IMAGE_PATH}/gyeonggi.webp`,
    width: 1200,
    height: 720,
    alt: "수원 화성 성곽과 주변 풍경",
    objectPosition: "50% 51%",
    sha256: "2ecaea44693012f9c1b3c07fab28f8be8702f81800a7eef016430d0e4bac2ed4",
  },
  cheonan: {
    src: `${ROOT_CARD_IMAGE_PATH}/cheonan.webp`,
    width: 1200,
    height: 720,
    alt: "천안 독립기념관 겨레의 집",
    objectPosition: "50% 50%",
    sha256: "99abb3084046dd9de038d935bea2e6f0d992898ccac08522f65bb34c9e54f19d",
  },
  asan: {
    src: `${ROOT_CARD_IMAGE_PATH}/asan.webp`,
    width: 1200,
    height: 720,
    alt: "아산 현충사 인근의 봄 정원",
    objectPosition: "50% 51%",
    sha256: "e78eee4c66b863e3ca2018662b2a37f9d21b7723783af80e7186fcda0cdc4a2a",
  },
  daejeon: {
    src: `${ROOT_CARD_IMAGE_PATH}/daejeon.webp`,
    width: 1200,
    height: 720,
    alt: "대전 엑스포다리의 야경",
    objectPosition: "50% 50%",
    sha256: "e2019888f96b02c4778fc5738cb9726573716d4ce6ffa7e7762113bf6d02a851",
  },
  daegu: {
    src: `${ROOT_CARD_IMAGE_PATH}/daegu.webp`,
    width: 1200,
    height: 720,
    alt: "두류공원에서 바라본 대구 시가지",
    objectPosition: "50% 50%",
    sha256: "336c22fa0b88a523122cddc2b75ef2bcceb6719bf8b3490779260b3384203811",
  },
  gumi: {
    src: `${ROOT_CARD_IMAGE_PATH}/gumi.webp`,
    width: 1200,
    height: 720,
    alt: "구미 금오산 케이블카와 숲",
    objectPosition: "50% 51%",
    sha256: "9dc19cbfc6f7d846555f0b5981ceaad0683395604410be9adf181547b0713bc5",
  },
  pohang: {
    src: `${ROOT_CARD_IMAGE_PATH}/pohang.webp`,
    width: 1200,
    height: 720,
    alt: "밤의 포항 영일대해수욕장",
    objectPosition: "50% 50%",
    sha256: "7637881e060f03efd13574c442dd93dad9a90c5bc9d89d17ef81e52f2c38fa17",
  },
  busan: {
    src: `${ROOT_CARD_IMAGE_PATH}/busan.webp`,
    width: 1200,
    height: 720,
    alt: "밤의 부산 광안대교",
    objectPosition: "50% 52%",
    sha256: "4ac0a9e53512b272396cf0fa8f3420c8c02d8773837f320dbc6c3a09955c229b",
  },
  jeju: {
    src: `${ROOT_CARD_IMAGE_PATH}/jeju.webp`,
    width: 1200,
    height: 720,
    alt: "제주 성산일출봉",
    objectPosition: "50% 52%",
    sha256: "e6c9fea8e5fd6d98a7e504a7f6448d243e0e102ddda92b1a04f70db81c05d137",
  },
} as const satisfies Record<ActiveRootKey, RootRegionCardImage>;
