import { describe, expect, it } from "vitest";
import {
  ACTIVE_REGION_NODES,
  ACTIVE_ROOT_KEYS,
  getActiveStaticParams,
  resolveRegionNode,
} from "@/lib/regions";

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
});
