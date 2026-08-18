import { describe, expect, it } from "vitest";
import {
  ACTIVE_REGION_NODES,
  ACTIVE_ROOT_KEYS,
  getActiveStaticParams,
  getKeywordRegionLabel,
  resolveRegionNode,
} from "@/lib/regions";
import {
  createKnownAdministrativeNameShortener,
  shortenOfficialAdministrativeName,
} from "@/lib/search-region-label";

const EXPECTED_BY_ROOT = {
  seoul: 262,
  incheon: 96,
  gyeonggi: 504,
  cheonan: 28,
  asan: 13,
  daejeon: 72,
  daegu: 96,
  gumi: 24,
  pohang: 32,
  busan: 122,
  jeju: 42,
} as const;

describe("MassageLove active region graph", () => {
  it("reconstructs exactly 1,291 active paths", () => {
    expect(ACTIVE_REGION_NODES).toHaveLength(1291);
    expect(getActiveStaticParams()).toHaveLength(1291);
    expect(new Set(ACTIVE_REGION_NODES.map((node) => node.path)).size).toBe(1291);
  });

  it("keeps the verified route count for every operating root", () => {
    for (const root of ACTIVE_ROOT_KEYS) {
      expect(ACTIVE_REGION_NODES.filter((node) => node.rootKey === root)).toHaveLength(
        EXPECTED_BY_ROOT[root],
      );
    }
  });

  it("contains 11 roots, 127 hubs, and 1,153 representative pages", () => {
    expect(ACTIVE_REGION_NODES.filter((node) => node.kind === "root")).toHaveLength(11);
    expect(ACTIVE_REGION_NODES.filter((node) => node.kind === "hub")).toHaveLength(127);
    expect(
      ACTIVE_REGION_NODES.filter((node) => node.kind === "representative"),
    ).toHaveLength(1153);
  });

  it("resolves every generated parameter back to the same canonical route", () => {
    for (const node of ACTIVE_REGION_NODES) {
      expect(resolveRegionNode(node.segments)?.path).toBe(node.path);
    }
  });

  it("shortens only known official administrative names for customer search labels", () => {
    expect(shortenOfficialAdministrativeName("제주특별자치도")).toBe("제주");
    expect(shortenOfficialAdministrativeName("세종특별자치시")).toBe("세종");
    expect(shortenOfficialAdministrativeName("서울특별시")).toBe("서울");
    expect(shortenOfficialAdministrativeName("인천광역시")).toBe("인천");
    expect(shortenOfficialAdministrativeName("경기도")).toBe("경기");
    expect(shortenOfficialAdministrativeName("수원시")).toBe("수원");

    const shortenKnown = createKnownAdministrativeNameShortener([
      "서울특별시",
      "인천광역시",
      "경기도",
      "수원시",
    ]);
    expect(shortenKnown("서울특별시출장마사지")).toBe("서울출장마사지");
    expect(shortenKnown("인천광역시 여성전용마사지")).toBe("인천 여성전용마사지");
    expect(shortenKnown("경기도 수원시 출장마사지")).toBe("경기 수원 출장마사지");
    expect(shortenKnown("송도·월미도·여의도")).toBe("송도·월미도·여의도");
  });

  it("keeps all 1,291 concise search labels unique and qualifies collisions with short parents", () => {
    const labels = ACTIVE_REGION_NODES.map(getKeywordRegionLabel);
    expect(new Set(labels).size).toBe(1291);

    for (const [path, expected] of [
      ["/areas/seoul", "서울"],
      ["/areas/incheon", "인천"],
      ["/areas/gyeonggi", "경기"],
      ["/areas/gyeonggi/%EC%88%98%EC%9B%90%EC%8B%9C", "수원"],
      ["/areas/jeju", "제주"],
      ["/areas/jeju/%EC%A0%9C%EC%A3%BC%EC%8B%9C", "제주제주"],
    ]) {
      const node = ACTIVE_REGION_NODES.find((candidate) => candidate.path === path);
      expect(node, path).toBeDefined();
      expect(getKeywordRegionLabel(node!)).toBe(expected);
    }

    for (const preserved of ["강남구", "강화군", "목천읍", "동면", "송도동"]) {
      const node = ACTIVE_REGION_NODES.find((candidate) => candidate.displayName === preserved);
      expect(node, preserved).toBeDefined();
      expect(getKeywordRegionLabel(node!)).toContain(preserved);
    }
  });
});
